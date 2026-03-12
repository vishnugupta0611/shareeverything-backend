require('dotenv').config()
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const connectDB = require('./connect/dbconnect')

const app = express()
const server = http.createServer(app)

// Socket.io setup with CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000","https://shareeverything.vercel.app"],
    methods: ["GET", "POST"]
  }
})

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://shareeverything.vercel.app"],
  credentials: true
}))
app.use(express.json())

// Connect to database
connectDB()

// Routes
app.use('/api/sessions', require('./routes/sessions'))
app.use('/api/signaling', require('./routes/signaling'))

// Socket.io for real-time signaling
require('./controller/socketHandler')(io)

const PORT = process.env.PORT || 4000

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})