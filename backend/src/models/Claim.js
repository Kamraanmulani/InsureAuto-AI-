const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true
  },
  claimType: {
    type: String,
    enum: ['PHOTO_IMAGE', 'VIDEO_WALK_AROUND'],
    default: 'PHOTO_IMAGE'
  },
  claimInfo: {
    date: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String },
    policyId: { type: String }
  },
  metadata: {
    // Image EXIF metadata fields
    has_exif: Boolean,
    timestamp: String,
    camera_make: String,
    camera_model: String,
    software: String,
    file_size_mb: Number,
    // Video container metadata fields
    duration_seconds: Number,
    fps: Number,
    frame_count: Number,
    width: Number,
    height: Number,
    aspect_ratio: String,
    codec: String,
    created_at: String,
    modified_at: String,
    has_video_stream: Boolean
  },
  keyframeSelection: {
    primaryPath: String,
    secondaryPath: String,
    compositePath: String,
    llavaMode: String,
    ranking: [mongoose.Schema.Types.Mixed],
    summary: String
  },
  analysis: {
    damageAssessment: {
      severity: String,
      damagedParts: [String],
      description: String,
      recommendation: String,
      score: Number,
      yoloAggregate: {
        areaCoverageRatio: Number,
        meanConfidence: Number,
        totalKeyframeDetections: Number
      }
    },
    fraudAnalysis: {
      overallScore: Number,
      riskLevel: String,
      isDuplicate: Boolean,
      fraudIndicators: [String],
      breakdown: {
        metadataScore: Number,
        duplicateScore: Number,
        consistencyScore: Number
      },
      videoDuplicateCheck: {
        isDuplicate: Boolean,
        similarityScore: Number,
        crossPolicyReuse: Boolean,
        isMirrored: Boolean,
        duplicateDetails: [mongoose.Schema.Types.Mixed]
      },
      metadataFraud: {
        score: Number,
        editingSoftwareDetected: Boolean,
        editingTools: [String]
      }
    },
    consistencyAnalysis: {
      score: Number,
      isConsistent: Boolean,
      explanation: String
    }
  },
  decision: {
    recommendation: {
      type: String,
      enum: ['APPROVE', 'MANUAL_REVIEW', 'REJECT']
    },
    confidence: String,
    explanation: String,
    reasons: [String],
    scores: {
      damage: Number,
      fraud: Number,
      consistency: Number
    },
    pillarBreakdown: mongoose.Schema.Types.Mixed
  },
  annotatedImagePath: String,
  primaryAnnotatedKeyframeUrl: String,
  keyframeTimeline: [mongoose.Schema.Types.Mixed],
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'REVIEWED', 'APPROVED', 'REJECTED'],
    default: 'PROCESSED'
  },
  assessorNotes: String,
  assessorOverride: {
    applied: { type: Boolean, default: false },
    originalRecommendation: String,
    newRecommendation: String,
    reason: String,
    assessorId: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
claimSchema.index({ 'claimInfo.policyId': 1 });
claimSchema.index({ 'decision.recommendation': 1 });
claimSchema.index({ claimType: 1 });
claimSchema.index({ status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
