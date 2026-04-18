const Session = require('../models/Session')

// In-memory store for instant-share rooms
const instantRooms = {}

// Auto-cleanup inactive rooms every 60s
setInterval(() => {
  const now = Date.now()
  for (const roomId in instantRooms) {
    if (now - instantRooms[roomId].lastActive > 10 * 60 * 1000) {
      delete instantRooms[roomId]
    }
  }
}, 60000)

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    // ── INSTANT SHARE ROOMS ──────────────────────────────────────

    socket.on('instant-join', (roomId) => {
      socket.join(roomId)

      if (!instantRooms[roomId]) {
        instantRooms[roomId] = {
          content: '',
          owner: socket.id,
          users: new Set(),
          editOpen: false,   // owner can toggle open editing to all
          lastActive: Date.now(),
        }
      }

      const room = instantRooms[roomId]
      room.users.add(socket.id)
      room.lastActive = Date.now()

      socket.emit('instant-init', {
        content: room.content,
        isOwner: room.owner === socket.id,
        editOpen: room.editOpen,
      })

      io.to(roomId).emit('instant-viewers', room.users.size)
      console.log(`${socket.id} joined instant room: ${roomId}`)
    })

    socket.on('instant-typing', ({ roomId, content }) => {
      const room = instantRooms[roomId]
      if (!room) return
      // Allow if owner OR editOpen is true
      if (socket.id !== room.owner && !room.editOpen) return
      if (content.length > 50000) return

      room.content = content
      room.lastActive = Date.now()
      socket.to(roomId).emit('instant-update', content)
    })

    // Owner toggles open editing for all viewers
    socket.on('instant-toggle-edit', ({ roomId, editOpen }) => {
      const room = instantRooms[roomId]
      if (!room || socket.id !== room.owner) return
      room.editOpen = editOpen
      io.to(roomId).emit('instant-edit-access', editOpen)
    })

    // ── WEBRTC SESSION ROOMS ─────────────────────────────────────
    
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

        // Notify others in room
        socket.to(sessionId).emit('user-joined', {
          userId: socket.id,
          message: 'Someone joined the session'
        })

        socket.emit('session-joined', {
          sessionId,
          message: 'Successfully joined session',
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
      
      if (targetId) {
        socket.to(targetId).emit('webrtc-signal', { from: socket.id, signal })
      } else {
        socket.to(sessionId).emit('webrtc-signal', { from: socket.id, signal })
      }
    })
    
    socket.on('file-progress', (data) => {
      const { sessionId, progress } = data
      socket.to(sessionId).emit('file-progress', { from: socket.id, progress })
    })
    
    socket.on('complete-session', async (sessionId) => {
      try {
        await Session.updateOne({ sessionId }, { status: 'completed' })
        io.to(sessionId).emit('session-completed', { message: 'Session completed successfully' })
        console.log(`Session ${sessionId} completed`)
      } catch (error) {
        console.error('Complete session error:', error)
      }
    })
    
    // ── DISCONNECT ───────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
      
      // WebRTC session cleanup
      if (socket.sessionId) {
        socket.to(socket.sessionId).emit('user-left', {
          userId: socket.id,
          message: 'Someone left the session'
        })
      }

      // Instant room cleanup
      for (const roomId in instantRooms) {
        const room = instantRooms[roomId]
        if (!room.users.has(socket.id)) continue

        room.users.delete(socket.id)

        if (room.owner === socket.id) {
          room.owner = [...room.users][0] || null
          if (room.owner) {
            io.to(room.owner).emit('instant-owner', true)
          }
        }

        io.to(roomId).emit('instant-viewers', room.users.size)

        if (room.users.size === 0) {
          delete instantRooms[roomId]
          console.log(`Instant room deleted: ${roomId}`)
        }
      }
    })
  })
}