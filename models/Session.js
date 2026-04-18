const mongoose = require('mongoose')

const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index on this field
  },
  durationSeconds: {
    type: Number,
    default: 3600
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  }
})

module.exports = mongoose.model('Session', SessionSchema)
