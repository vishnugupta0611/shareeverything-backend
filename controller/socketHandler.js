const Session = require('../models/Session')

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)
    
    // Join session room
    socket.on('join-session', async (sessionId) => {
      try {
        // Verify session exists
        const session = await Session.findOne({ 
          sessionId, 
          status: 'active' 
        })
        
        if (!session) {
          socket.emit('error', { message: 'Invalid session' })
          return
        }
        
        // Join room
        socket.join(sessionId)
        socket.sessionId = sessionId
        
        // Notify others
        socket.to(sessionId).emit('user-joined', {
          userId: socket.id,
          message: 'Someone joined the session'
        })
        
        socket.emit('session-joined', {
          sessionId,
          message: 'Successfully joined session'
        })
        
        console.log(`User ${socket.id} joined session: ${sessionId}`)
      } catch (error) {
        console.error('Join session error:', error)
        socket.emit('error', { message: 'Failed to join session' })
      }
    })
    
    // Handle WebRTC signaling
    socket.on('webrtc-signal', (data) => {
      const { sessionId, signal, targetId } = data
      
      if (!sessionId || !signal) {
        socket.emit('error', { message: 'Invalid signal data' })
        return
      }
      
      // Send to specific user or broadcast to room
      if (targetId) {
        socket.to(targetId).emit('webrtc-signal', {
          from: socket.id,
          signal
        })
      } else {
        socket.to(sessionId).emit('webrtc-signal', {
          from: socket.id,
          signal
        })
      }
    })
    
    // Handle file transfer progress
    socket.on('file-progress', (data) => {
      const { sessionId, progress } = data
      socket.to(sessionId).emit('file-progress', {
        from: socket.id,
        progress
      })
    })
    
    // Handle session completion
    socket.on('complete-session', async (sessionId) => {
      try {
        await Session.updateOne(
          { sessionId },
          { status: 'completed' }
        )
        
        io.to(sessionId).emit('session-completed', {
          message: 'Session completed successfully'
        })
        
        console.log(`Session ${sessionId} completed`)
      } catch (error) {
        console.error('Complete session error:', error)
      }
    })
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
      
      if (socket.sessionId) {
        socket.to(socket.sessionId).emit('user-left', {
          userId: socket.id,
          message: 'Someone left the session'
        })
      }
    })
  })
}