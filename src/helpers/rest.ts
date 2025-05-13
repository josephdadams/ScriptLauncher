import type { Express, Request, Response } from 'express'
import { CommandHandlers, CommandGroups } from './commands.js'
import os from 'os'
import { getAppVersion } from './version.js'

const APP_VERSION = getAppVersion()

export function registerRestHandlers(app: Express): void {
    const handler = async (req: Request, res: Response): Promise<void> => {
        const {
            command: commandName,
            password,
            params: nestedParams,
            ...rest
        } = req.body

        // Combine flat and nested params, preferring nested if defined
        const params =
            typeof nestedParams === 'object' && nestedParams !== null
                ? { ...rest, ...nestedParams }
                : { ...rest }

        if (
            !commandName ||
            typeof CommandHandlers[commandName] !== 'function'
        ) {
            res.status(400).json({
                command: commandName,
                error: `Unknown command '${commandName}'`,
            })
            return
        }

        try {
            const result = await CommandHandlers[commandName](
                params,
                password,
                {
                    emit: (event: any, data: any) =>
                        console.log(`[REST] Emitted ${event}`, data),
                    platform: process.platform,
                }
            )
            res.json({ command: commandName, status: 'ok', result })
        } catch (err: any) {
            console.error(`[REST] Command '${commandName}' failed:`, err)
            res.status(500).json({
                command: commandName,
                error: err.message || 'Internal server error',
            })
        }
    }

    app.post('/command', handler)

    app.get('/commands', (_: Request, res: Response) => {
        const commandList = Object.entries(CommandGroups).flatMap(
            ([group, commands]) =>
                Object.entries(commands).map(([name, fn]) => {
                    const meta = (fn as any)._meta || {}
                    return {
                        name,
                        group,
                        description: meta.description || '',
                        paramsExample: meta.paramsExample || {},
                        requiresPassword: meta.requiresPassword ?? true,
                    }
                })
        )

        res.json({
            status: 'ok',
            count: commandList.length,
            commands: commandList,
        })
    })

    app.get('/', (_: Request, res: Response) => {
        res.json({
            command: 'platform',
            status: 'ok',
            result: {
                version: APP_VERSION,
                platform: process.platform,
                arch: process.arch,
                hostname: os.hostname(),
                uptime: process.uptime(),
            },
        })
    })
}
