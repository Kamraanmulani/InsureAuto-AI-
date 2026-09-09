const mongoose = require('mongoose');

const CLAIM_STATUS = {
  SUBMITTED: 'SUBMITTED',
  PROCESSING: 'PROCESSING',
  AI_ASSESSED: 'AI_ASSESSED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  NEEDS_INFORMATION: 'NEEDS_INFORMATION',
  CLOSED: 'CLOSED'
};

const ALLOWED_TRANSITIONS = {
  SUBMITTED: ['PROCESSING', 'CLOSED'],
  PROCESSING: ['PROCESSING', 'AI_ASSESSED', 'PENDING_REVIEW', 'CLOSED'],
  AI_ASSESSED: ['PENDING_REVIEW', 'UNDER_REVIEW', 'CLOSED'],
  PENDING_REVIEW: ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'CLOSED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'CLOSED'],
  NEEDS_INFORMATION: ['PROCESSING', 'PENDING_REVIEW', 'UNDER_REVIEW', 'CLOSED'],
  APPROVED: ['CLOSED'],
  REJECTED: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: []
};

const evidenceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['PHOTO', 'VIDEO', 'DOCUMENT', 'OTHER'],
    default: 'PHOTO'
  },
  fileReference: {
    type: String,
    required: true
  },
  rawFilePath: {
    type: String,
    default: null
  },
  uploadTimestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  processingStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PROCESSING'
  },
  error: {
    type: String,
    default: null
  },
  analysisResults: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  originalName: String
}, { _id: true });

const customerSchema = new mongoose.Schema({
  customerId: { type: String, default: '' },
  name: { type: String, default: 'Unassigned Policyholder' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { _id: false });

const policySchema = new mongoose.Schema({
  policyNumber: { type: String, default: 'POL-UNASSIGNED' },
  policyType: { type: String, default: 'Comprehensive Motor' },
  coverageType: { type: String, default: 'Standard Collision' },
  deductible: { type: String, default: '$500' },
  effectiveDate: { type: String, default: '' }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  registration: { type: String, default: 'UNREGISTERED' },
  make: { type: String, default: 'Standard' },
  model: { type: String, default: 'Sedan' },
  year: { type: Number, default: 2022 },
  vin: { type: String, default: '' }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  time: { type: String, default: '12:00 PM' },
  location: { type: String, default: 'Unknown Location' },
  incidentType: { type: String, default: 'Collision' },
  description: { type: String, required: true }
}, { _id: false });

const aiAssessmentSchema = new mongoose.Schema({
  damageAssessment: {
    available: { type: Boolean, default: true },
    status: { type: String, default: 'EVALUATED' },
    severity: { type: String, default: 'Unknown' },
    damagedParts: { type: [String], default: [] },
    description: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    score: { type: Number, default: 0 },
    yoloAggregate: mongoose.Schema.Types.Mixed
  },
  fraudAssessment: {
    overallScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'LOW' },
    isDuplicate: { type: Boolean, default: false },
    fraudIndicators: { type: [String], default: [] },
    breakdown: mongoose.Schema.Types.Mixed,
    videoDuplicateCheck: mongoose.Schema.Types.Mixed,
    metadataFraud: mongoose.Schema.Types.Mixed
  },
  consistencyAssessment: {
    score: { type: Number, default: 0 },
    isConsistent: { type: Boolean, default: true },
    explanation: { type: String, default: '' }
  },
  recommendation: {
    type: String,
    enum: ['APPROVE', 'MANUAL_REVIEW', 'REJECT'],
    default: 'MANUAL_REVIEW'
  },
  confidence: {
    type: String,
    default: 'MEDIUM'
  },
  supportingEvidence: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  explanation: { type: String, default: '' },
  reasons: { type: [String], default: [] },
  pillarBreakdown: mongoose.Schema.Types.Mixed,
  scores: {
    damage: { type: Number, default: 0 },
    fraud: { type: Number, default: 0 },
    consistency: { type: Number, default: 0 }
  },
  keyframeSelection: mongoose.Schema.Types.Mixed,
  primaryAnnotatedKeyframeUrl: String
}, { _id: false });

const humanAssessmentSchema = new mongoose.Schema({
  assessor: {
    id: String,
    name: String,
    email: String
  },
  action: { type: String, default: '' },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: null },
  notes: { type: String, default: '' }
}, { _id: false });

const decisionSchema = new mongoose.Schema({
  outcome: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'CLOSED'],
    default: 'PENDING'
  },
  reason: { type: String, default: '' },
  decisionMaker: {
    id: String,
    name: String
  },
  timestamp: { type: Date, default: null }
}, { _id: false });

const auditEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  action: { type: String, required: true },
  actor: {
    id: { type: String, default: 'SYSTEM' },
    name: { type: String, default: 'System' },
    role: { type: String, default: 'SYSTEM' }
  },
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null },
  details: { type: String, default: '' }
}, { _id: false });

const processingErrorSchema = new mongoose.Schema({
  message: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: null },
  retryCount: { type: Number, default: 0 }
}, { _id: false });

const claimSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  claimType: {
    type: String,
    enum: ['PHOTO_IMAGE', 'VIDEO_WALK_AROUND'],
    default: 'PHOTO_IMAGE'
  },
  status: {
    type: String,
    enum: Object.values(CLAIM_STATUS),
    default: CLAIM_STATUS.SUBMITTED,
    index: true
  },
  customer: {
    type: customerSchema,
    default: () => ({})
  },
  policy: {
    type: policySchema,
    default: () => ({})
  },
  vehicle: {
    type: vehicleSchema,
    default: () => ({})
  },
  incident: {
    type: incidentSchema,
    required: true
  },
  evidence: {
    type: [evidenceSchema],
    default: []
  },
  aiAssessment: {
    type: aiAssessmentSchema,
    default: () => ({})
  },
  humanAssessment: {
    type: humanAssessmentSchema,
    default: () => ({})
  },
  decision: {
    type: decisionSchema,
    default: () => ({ outcome: 'PENDING' })
  },
  auditHistory: {
    type: [auditEntrySchema],
    default: []
  },
  processingError: {
    type: processingErrorSchema,
    default: () => ({ message: null, details: null, timestamp: null, retryCount: 0 })
  },
  claimInfo: {
    date: String,
    description: String,
    location: String,
    policyId: String
  },
  metadata: mongoose.Schema.Types.Mixed,
  analysis: mongoose.Schema.Types.Mixed,
  annotatedImagePath: String,
  primaryAnnotatedKeyframeUrl: String,
  keyframeSelection: mongoose.Schema.Types.Mixed,
  keyframeTimeline: [mongoose.Schema.Types.Mixed],
  assessorNotes: String,
  assessorOverride: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

claimSchema.methods.canTransitionTo = function(targetStatus) {
  const current = this.status || CLAIM_STATUS.SUBMITTED;
  if (current === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(targetStatus);
};

claimSchema.statics.canTransition = function(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

claimSchema.post('init', function() {
  this._originalStatus = this.status;
});

claimSchema.pre('validate', function(next) {
  if (!this.claimId && this.jobId) {
    this.claimId = this.jobId.startsWith('CLM-') ? this.jobId : `CLM-${this.jobId.slice(0, 8).toUpperCase()}`;
  } else if (!this.jobId && this.claimId) {
    this.jobId = this.claimId;
  }
  if (!this.claimId && !this.jobId) {
    const generated = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.claimId = generated;
    this.jobId = generated;
  }
  next();
});

claimSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('status') && this._originalStatus && ALLOWED_TRANSITIONS[this._originalStatus]) {
    if (this._originalStatus !== this.status) {
      const allowed = ALLOWED_TRANSITIONS[this._originalStatus] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid lifecycle state transition from ${this._originalStatus} to ${this.status}`));
      }
    }
  }
  this._originalStatus = this.status;
  next();
});

claimSchema.index({ 'policy.policyNumber': 1 });
claimSchema.index({ 'vehicle.registration': 1 });
claimSchema.index({ 'customer.customerId': 1 });
claimSchema.index({ 'aiAssessment.recommendation': 1 });
claimSchema.index({ 'decision.outcome': 1 });
claimSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Claim', claimSchema);
module.exports.CLAIM_STATUS = CLAIM_STATUS;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
