// --- api.ts ---
import express from 'express'
import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import {
    registerSocketHandlers,
    stopSystemInfoInterval,
} from './helpers/socketHandlers.js'

import { registerRestHandlers } from './helpers/rest.js'

export function initializeServer(): HttpServer {
    const app = express()
    const server = new HttpServer(app)
    const io = new SocketIOServer(server)

    app.use(express.json())

    registerSocketHandlers(io)

    registerRestHandlers(app)

    server.on('close', () => {
        stopSystemInfoInterval()
    })

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    return server
}

let cleanupCalled = false

function cleanup() {
    if (cleanupCalled) return
    cleanupCalled = true

    console.log('Cleaning up before shutdown...')
    stopSystemInfoInterval()
    console.log('Cleanup complete. Exiting now.')
    process.exit(0)
}
