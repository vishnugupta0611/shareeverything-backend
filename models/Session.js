const mongoose = require('mongoose')

const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200 // 2 hours TTL
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  }
})

module.exports = mongoose.model('Session', SessionSchema)