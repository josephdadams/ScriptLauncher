import { CommandError } from './errors.js'

// robotjs is a native module that has to be compiled for the running Electron
// ABI, and on Linux it links against X11/XTest. Importing it at module scope
// meant a missing or unbuildable binary took down the whole app, since this
// file is pulled in by the command table. Load it on first use instead so only
// sendInput is affected.
type RobotJs = typeof import('robotjs')

let robot: RobotJs | null = null
let loadError: string | null = null

async function loadRobot(): Promise<RobotJs> {
    if (robot) return robot

    if (loadError === null) {
        try {
            const mod = await import('robotjs')
            robot = ((mod as any).default ?? mod) as RobotJs
            return robot
        } catch (error) {
            loadError = error instanceof Error ? error.message : String(error)
        }
    }

    throw new CommandError(
        `Input simulation is unavailable: robotjs failed to load (${loadError}).` +
            (process.platform === 'linux'
                ? ' On Linux it needs an X11 session plus libX11/libXtst at build time; it cannot inject input under Wayland.'
                : ''),
        501
    )
}

export async function sendInputCommand(cmd: any) {
    console.log('sendInputCommand', cmd)
    const robot = await loadRobot()

    switch (cmd.type) {
        case 'keyDown':
            robot.keyToggle(cmd.key, 'down')
            break

        case 'keyUp':
            robot.keyToggle(cmd.key, 'up')
            break

        case 'keyPress':
            console.log('keyPress', cmd.key)
            let modifiers = cmd.modifiers || []
            if (typeof modifiers === 'string') {
                modifiers = [modifiers]
            }
            if (modifiers.length > 0) {
                modifiers = modifiers.map((mod: string) => mod.toLowerCase())
                robot.keyTap(cmd.key, modifiers)
            } else {
                robot.keyTap(cmd.key)
            }

            break

        case 'mouseSetPosition':
            robot.moveMouseSmooth(Number(cmd.x), Number(cmd.y))
            break

        case 'mouseClick':
            robot.mouseClick(cmd.button || 'left', cmd.double === 'true')
            break

        case 'mouseClickHold':
            robot.mouseToggle('down', cmd.button || 'left')
            break

        case 'mouseClickRelease':
            robot.mouseToggle('up', cmd.button || 'left')
            break

        case 'mouseScroll':
            robot.scrollMouse(Number(cmd.x) || 0, Number(cmd.y) || 0)
            break
    }
}
