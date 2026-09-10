const mongoose = require("mongoose");
const User = require("../models/User");
const Claim = require("../models/Claim");
const { CLAIM_STATUS } = require("../models/Claim");

const seedInitialUsers = async () => {
  try {
    const admin = await User.findOne({
      $or: [
        { email: "admin@insureauto.ai" },
        { email: "admin@claimsight.internal" },
        { role: "ADMIN" },
      ],
    });
    if (!admin) {
      const newAdmin = new User({
        email: "admin@insureauto.ai",
        password: "AdminPassword@123",
        name: "System Administrator",
        role: "ADMIN",
      });
      await newAdmin.save();
    } else if (admin.email === "admin@claimsight.internal") {
      admin.email = "admin@insureauto.ai";
      await admin.save();
    }

    const assessor = await User.findOne({
      $or: [
        { email: "assessor@insureauto.ai" },
        { email: "assessor@claimsight.internal" },
      ],
    });
    if (!assessor) {
      const newAssessor = new User({
        email: "assessor@insureauto.ai",
        password: "Password@123",
        name: "Sarah Jenkins",
        role: "ASSESSOR",
      });
      await newAssessor.save();
    } else if (assessor.email === "assessor@claimsight.internal") {
      assessor.email = "assessor@insureauto.ai";
      await assessor.save();
    }
  } catch (err) {
    console.error("Initial user seed error:", err.message);
  }
};

const migrateLegacyClaims = async () => {
  try {
    const claims = await Claim.find({
      $or: [
        { claimId: { $exists: false } },
        {
          status: {
            $in: ["PENDING", "PROCESSED", "REVIEW_REQUIRED", "REVIEWED"],
          },
        },
        { incident: { $exists: false } },
        { "incident.date": { $exists: false } },
        { evidence: { $size: 0 } },
        { customer: { $exists: false } },
        { policy: { $exists: false } },
        { vehicle: { $exists: false } },
        { aiAssessment: { $exists: false } },
      ],
    });

    for (const claim of claims) {
      if (!claim.claimId) {
        if (claim.jobId) {
          claim.claimId = claim.jobId.startsWith("CLM-")
            ? claim.jobId
            : `CLM-${claim.jobId.slice(0, 8).toUpperCase()}`;
        } else {
          claim.claimId = `CLM-${claim._id.toString().slice(0, 8).toUpperCase()}`;
        }
      }

      if (!claim.jobId) {
        claim.jobId = claim.claimId;
      }

      if (["PENDING", "PROCESSED"].includes(claim.status)) {
        claim.status = CLAIM_STATUS.PENDING_REVIEW;
      } else if (["REVIEW_REQUIRED", "REVIEWED"].includes(claim.status)) {
        claim.status = CLAIM_STATUS.UNDER_REVIEW;
      } else if (!Object.values(CLAIM_STATUS).includes(claim.status)) {
        claim.status = CLAIM_STATUS.PENDING_REVIEW;
      }

      if (!claim.incident || !claim.incident.date) {
        claim.incident = {
          date: claim.claimInfo?.date || new Date().toISOString().split("T")[0],
          time: "12:00 PM",
          location: claim.claimInfo?.location || "Unknown Location",
          incidentType: "Collision",
          description: claim.claimInfo?.description || "Incident on record",
        };
      }

      if (!claim.policy || !claim.policy.policyNumber) {
        claim.policy = {
          policyNumber: claim.claimInfo?.policyId || "POL-UNASSIGNED",
          policyType: "Comprehensive Motor",
          coverageType: "Standard Collision",
          deductible: "₹5,000",
          effectiveDate: "Jan 2026",
        };
      }

      if (!claim.customer || !claim.customer.name) {
        claim.customer = {
          customerId: `CUST-${(claim.claimInfo?.policyId || "101").replace(/\D/g, "").slice(0, 4) || "101"}`,
          name: `Policyholder ${claim.claimInfo?.policyId || ""}`,
          email: "client@insureauto.ai",
          phone: "+1 (555) 019-2831",
        };
      }

      if (!claim.vehicle || !claim.vehicle.registration) {
        claim.vehicle = {
          registration: "UNREGISTERED",
          make: claim.metadata?.camera_make || "Standard",
          model: "Sedan",
          year: 2022,
          vin: "",
        };
      }

      if (!claim.evidence || claim.evidence.length === 0) {
        const fileRef =
          claim.primaryAnnotatedKeyframeUrl ||
          claim.annotatedImagePath ||
          "evidence_file";
        claim.evidence = [
          {
            type: claim.claimType === "VIDEO_WALK_AROUND" ? "VIDEO" : "PHOTO",
            fileReference: fileRef,
            originalName: fileRef.split("/").pop() || "evidence",
            uploadTimestamp: claim.createdAt || new Date(),
            metadata: claim.metadata || {},
            processingStatus: "COMPLETED",
            analysisResults: claim.analysis || {},
          },
        ];
      }

      if (!claim.aiAssessment || !claim.aiAssessment.recommendation) {
        claim.aiAssessment = {
          damageAssessment: claim.analysis?.damageAssessment || {},
          fraudAssessment: claim.analysis?.fraudAnalysis || {},
          consistencyAssessment: claim.analysis?.consistencyAnalysis || {},
          recommendation: claim.decision?.recommendation || "MANUAL_REVIEW",
          confidence: claim.decision?.confidence || "MEDIUM",
          explanation: claim.decision?.explanation || "",
          scores: claim.decision?.scores || {
            damage: 0,
            fraud: 0,
            consistency: 0,
          },
          supportingEvidence: claim.keyframeTimeline || [],
        };
      }

      if (!claim.decision || !claim.decision.outcome) {
        claim.decision = {
          outcome: ["APPROVED", "REJECTED", "CLOSED"].includes(claim.status)
            ? claim.status
            : "PENDING",
          reason: claim.assessorNotes || "",
          decisionMaker: null,
          timestamp: null,
        };
      }

      if (!claim.humanAssessment) {
        claim.humanAssessment = {
          assessor: null,
          action: "",
          reason: "",
          timestamp: null,
          notes: "",
        };
      }

      if (!claim.auditHistory || claim.auditHistory.length === 0) {
        claim.auditHistory = [
          {
            timestamp: claim.createdAt || new Date(),
            action: "LEGACY_MIGRATION",
            actor: {
              id: "SYSTEM_MIGRATION",
              name: "Database Normalizer",
              role: "SYSTEM",
            },
            previousStatus: "LEGACY",
            newStatus: claim.status,
            details:
              "Claim data safely migrated to normalized motor claim workflow model",
          },
        ];
      }

      await Claim.updateOne(
        { _id: claim._id },
        {
          $set: {
            claimId: claim.claimId,
            jobId: claim.jobId,
            status: claim.status,
            customer: claim.customer,
            policy: claim.policy,
            vehicle: claim.vehicle,
            incident: claim.incident,
            evidence: claim.evidence,
            aiAssessment: claim.aiAssessment,
            humanAssessment: claim.humanAssessment,
            decision: claim.decision,
            auditHistory: claim.auditHistory,
          },
        },
      );
    }
  } catch (err) {
    console.error("Legacy migration error:", err.message);
  }
};

const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/insurance_claims";
  try {
    const conn = await mongoose.connect(mongoUri);
    await seedInitialUsers();
    await migrateLegacyClaims();
    console.log("Database connected successfully");
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
