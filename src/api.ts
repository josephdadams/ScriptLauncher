// --- api.ts ---
import express from 'express'
import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import {
    registerSocketHandlers,
    stopSystemInfoInterval,
} from './helpers/socketHandlers.js'

import { readFileSync } from 'fs'
const APP_VERSION = JSON.parse(readFileSync('./package.json', 'utf-8')).version

export function initializeServer(): HttpServer {
    const app = express()
    const server = new HttpServer(app)
    const io = new SocketIOServer(server)

    app.use(express.json())

    registerSocketHandlers(io)

    server.on('close', () => {
        stopSystemInfoInterval()
    })

    app.get('/', (_, res) => {
        res.json({
            status: 'ok',
            name: 'ScriptLauncher API',
            version: APP_VERSION,
            uptime: process.uptime(),
            hostname: require('os').hostname(),
        })
    })

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    return server
}

function cleanup() {
    console.log('Cleaning up before shutdown...')
    // stop any intervals, close files, etc.
    stopSystemInfoInterval()
    console.log('Cleanup complete. Exiting now.')
    process.exit(0)
}
