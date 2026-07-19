# ScriptLauncher

<img src="assets/tray-icon.png" alt="Logo" width="200px" />

ScriptLauncher runs scripts. That's it. It's really simple — but also powerful.

Use it to automate local tasks, simulate inputs, manage files, or send system commands from anywhere using Bitfocus Companion or a custom frontend.

## ✅ How to Use ScriptLauncher

1. **Download**: [Grab the latest release](https://github.com/josephdadams/scriptlauncher/releases)

2. **Run from Source** (for development):

```bash
git clone https://github.com/josephdadams/scriptlauncher
cd scriptlauncher
yarn
yarn start
```

3. **Configure**: Right-click the tray icon and open **Settings** to set your password and preferences.

---

## 🛠 Development

You'll need Node.js and Yarn. Then:

```bash
git clone https://github.com/josephdadams/scriptlauncher
cd ScriptLauncher
yarn
yarn start
```

### Build for Production

```bash
yarn build        # Transpile code
yarn dist         # Create platform-specific installers
```

---

## ⚡ API

ScriptLauncher exposes both **Socket.IO** and **REST APIs** for automation.

### Base URL

```
http://localhost:8810
```

### 🔌 Socket.IO API

Use `io.connect('http://localhost:8810')` to get started.

#### Common Events

- `command` — General-purpose command trigger. Send an object with:
    - `command`: The command name
    - `password`: Your password
    - Other properties depending on the command

**Example**:

```ts
socket.emit('command', {
    command: 'shutdown',
    password: 'admin',
    time: 5,
})
```

#### Result Events

Every command replies on a single `command_result` event with an object of
the shape `{ command, status, result }` (or `{ command, error }` on failure):

```ts
socket.on('command_result', (msg) => console.log(msg))
```

#### Supported Commands (Partial List)

- `runScript` — Run any local script/executable
- `shutdown`, `shutdown_cancel`, `reboot`, `lock`
- `sendAlert`, `getFonts`, `getSystemInfo`
- `moveFile`, `moveDatedFileInFolder`, `moveFileBasedOnSize`
- `focusApp`, `quitApp`
- `sendInput` (with subtypes like keyPress, mouseClick, etc.)

---

### 🌐 REST API

#### POST `/command`

Send any command with JSON body:

```json
{
    "command": "shutdown",
    "password": "admin",
    "time": 5
}
```

#### GET `/commands`

Returns a list of all available commands with metadata.

---

## 🔒 Security

Most actions require the configured password for authorization. The default
password is `admin` — **change it** in Settings before exposing the app, and
keep it secret. ScriptLauncher can run arbitrary local commands, so treat
network access to it as equivalent to shell access on the machine.

---

## 🤝 Contributing

1. Fork this repo
2. Create a new branch:

```bash
git checkout -b feature-name
```

3. Submit a pull request with clear description

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

## 🙋 Support

Have a question or idea? Use [GitHub Issues](https://github.com/josephdadams/scriptlauncher/issues) to start a discussion or report a bug.

---

Built with 💻 by [@josephdadams](https://github.com/josephdadams)
