import robot from 'robotjs'

export function sendInputCommand(cmd: any) {
    console.log('sendInputCommand', cmd)
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
