const express = require('express')
const router = express.Router()
const Session = require('../models/Session')

const VALID_DURATIONS = [300, 600, 1800, 3600, 7200]
const DEFAULT_DURATION = 3600

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
        let durationSeconds = parseInt(req.body?.durationSeconds) || DEFAULT_DURATION
        // Clamp to valid range
        if (!VALID_DURATIONS.includes(durationSeconds)) {
            durationSeconds = DEFAULT_DURATION
        }

        let sessionId
        let attempts = 0
        const maxAttempts = 10

        do {
            sessionId = generateSessionKey()
            attempts++
            const existingSession = await Session.findOne({ sessionId })
            if (!existingSession) break
            if (attempts >= maxAttempts) throw new Error('Unable to generate unique session ID')
        } while (attempts < maxAttempts)

        const now = new Date()
        const expiresAt = new Date(now.getTime() + durationSeconds * 1000)

        const newSession = new Session({
            sessionId,
            status: 'active',
            durationSeconds,
            expiresAt,
        })

        await newSession.save()

        res.json({
            success: true,
            sessionId,
            expiresAt: expiresAt.toISOString(),
            durationSeconds,
            message: 'Session created successfully'
        })
    } catch (error) {
        console.error('Create session error:', error)
        res.status(500).json({ success: false, error: 'Failed to create session' })
    }
})

// Join existing session
router.post('/join', async (req, res) => {
    try {
        const { sessionId } = req.body
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Session ID required' })
        }

        const session = await Session.findOne({ sessionId, status: 'active' })
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found or expired' })
        }

        res.json({
            success: true,
            sessionId: session.sessionId,
            message: 'Session joined successfully'
        })
    } catch (error) {
        console.error('Join session error:', error)
        res.status(500).json({ success: false, error: 'Failed to join session' })
    }
})

// Check if session exists
router.get('/check/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params
        const session = await Session.findOne({ sessionId, status: 'active' })

        res.json({
            success: true,
            exists: !!session,
            sessionId: session?.sessionId,
            expiresAt: session?.expiresAt?.toISOString() || null,
            durationSeconds: session?.durationSeconds || null,
        })
    } catch (error) {
        console.error('Check session error:', error)
        res.status(500).json({ success: false, error: 'Failed to check session' })
    }
})

// End a session (mark as completed)
router.post('/end', async (req, res) => {
    try {
        const { sessionId } = req.body
        if (!sessionId) return res.status(400).json({ success: false, error: 'Session ID required' })
        await Session.updateOne({ sessionId }, { status: 'completed' })
        res.json({ success: true })
    } catch (error) {
        console.error('End session error:', error)
        res.status(500).json({ success: false, error: 'Failed to end session' })
    }
})

module.exports = router
