const express = require('express')
const router = express.Router()


const signalingStore = new Map()


setInterval(() => {
  const now = Date.now()
  for (const [sessionId, data] of signalingStore.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
      signalingStore.delete(sessionId)
    }
  }
}, 10 * 60 * 1000)

// Handle signaling messages
router.post('/', async (req, res) => {
  try {
    const { sessionId, type, data } = req.body
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required'
      })
    }
    
    // Initialize session if doesn't exist
    if (!signalingStore.has(sessionId)) {
      signalingStore.set(sessionId, {
        messages: [],
        createdAt: Date.now(),
        participants: 0
      })
    }
    
    const session = signalingStore.get(sessionId)
    
    switch (type) {
      case 'join':
        session.participants++
        res.json({
          success: true,
          participants: session.participants
        })
        break
        
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        const message = {
          type,
          data,
          timestamp: Date.now(),
          id: Math.random().toString(36).substr(2, 9)
        }
        
        session.messages.push(message)
        
        // Keep only last 20 messages
        if (session.messages.length > 20) {
          session.messages = session.messages.slice(-20)
        }
        
        res.json({
          success: true,
          messageId: message.id
        })
        break
        
      case 'poll':
        const { lastMessageId } = data || {}
        let messages = session.messages
        
        if (lastMessageId) {
          const lastIndex = messages.findIndex(m => m.id === lastMessageId)
          messages = lastIndex >= 0 ? messages.slice(lastIndex + 1) : messages
        }
        
        res.json({
          success: true,
          messages,
          participants: session.participants
        })
        break
        
      case 'leave':
        session.participants = Math.max(0, session.participants - 1)
        res.json({
          success: true
        })
        break
        
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid message type'
        })
    }
  } catch (error) {
    console.error('Signaling error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Get session info
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const session = signalingStore.get(sessionId)
  
  res.json({
    success: true,
    exists: !!session,
    participants: session?.participants || 0,
    messageCount: session?.messages?.length || 0
  })
})

module.exports = router