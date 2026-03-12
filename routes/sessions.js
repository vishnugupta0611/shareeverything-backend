const express = require('express')
const router = express.Router()
const Session = require('../models/Session')


const generateSessionKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

// Create new session
router.post('/create', async (req, res) => {
    try {
        let sessionId
        let attempts = 0
        const maxAttempts = 10

        // Generate unique session ID
        do {
            sessionId = generateSessionKey()
            attempts++

            // Check if session already exists
            const existingSession = await Session.findOne({ sessionId })
            if (!existingSession) {
                break
            }

            if (attempts >= maxAttempts) {
                throw new Error('Unable to generate unique session ID')
            }
        } while (attempts < maxAttempts)

        const newSession = new Session({
            sessionId,
            status: 'active'
        })

        await newSession.save()

        res.json({
            success: true,
            sessionId,
            message: 'Session created successfully'
        })
    } catch (error) {
        console.error('Create session error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to create session'
        })
    }
})

// Join existing session
router.post('/join', async (req, res) => {
    try {
        const { sessionId } = req.body

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID required'
            })
        }

        const session = await Session.findOne({
            sessionId,
            status: 'active'
        })

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found or expired'
            })
        }

        res.json({
            success: true,
            sessionId: session.sessionId,
            message: 'Session joined successfully'
        })
    } catch (error) {
        console.error('Join session error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to join session'
        })
    }
})

// Check if session exists
router.get('/check/:sessionId', async (req, res) => {
    try {
        console.log(req.params)
        const { sessionId } = req.params

        const session = await Session.findOne({
            sessionId,
            status: 'active'
        })
         
        console.log(session)

        res.json({
            success: true,
            exists: !!session,
            sessionId: session?.sessionId
        })
    } catch (error) {
        console.error('Check session error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to check session'
        })
    }
})

module.exports = router