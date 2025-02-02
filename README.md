# ScriptLauncher

<img src="assets/tray-icon.png" alt="Logo" width="200px" />

ScriptLauncher runs scripts. That's it. It's really simple.

## How to Use ScriptLauncher

1. **Download and Install**: Download the latest release here: https://github.com/josephdadams/scriptlauncher/releases

1. **Run from Source**: Clone the repository and install dependencies using Yarn:

    ```bash
    git clone https://github.com/josephdadams/scriptlauncher
    cd scriptlauncher
    yarn
    yarn start
    ```

    Configure Your Settings: Open the settings window to set up the password and any other settings.

## Contributing

Contributions are welcome! To contribute to the development of ScriptLauncher:

1. Fork the Repository: Create a fork of the main repository to your GitHub account.
1. Create a Branch: Create a new branch for your feature or bug fix:

    ```bash
    git checkout -b feature-name
    ```

1. Make Changes: Implement your changes and test them thoroughly.
1. Submit a Pull Request: Once your changes are ready, submit a pull request to the main repository with a clear description of your changes.

## Development

To develop ScriptLauncher, you will need to have Node.js and Yarn installed. Follow these steps to set up your development environment.

1. Clone the Repository:

    ```bash
    git clone https://github.com/josephdadams/scriptlauncher
    cd ScriptLauncher
    ```

1. Install Dependencies:

    ```bash
    yarn
    ```

1. Run the Application:

    ```bash
    yarn start
    ```

1. Build the Application:

    ```bash
    yarn build
    ```

1. Package the Application using electron-builder:

    ```
    yarn dist
    ```

# API

ScriptLauncher provides a **Socket.IO-based API**. It is available on **Port `8810`**.

## Overview

The ScriptLauncher API allows users to execute scripts through various executables (such as `node`, `python`, `bash`, etc.). Scripts can be passed as raw code, and the results of execution are returned through socket events. The API also includes predefined commands for system management tasks like shutdown, reboot, and fetching system information.

## Base URL

The socket.io API is available on the following URL:

```
http://localhost:8810
```

## API Endpoint

The **Socket.IO API** allows real-time interaction with the ScriptLauncher service, where clients can send scripts for execution and receive results.

#### Events:

- **`connect`**: Triggered when a client successfully connects to the server.
- **`disconnect`**: Triggered when the client disconnects from the server.
- **`execute`**: Custom event used to send a script to the server for execution. The script will be executed using the specified executable.
- **`shutdown`**: Custom event used to trigger a system shutdown with a custom time.
- **`reboot`**: Predefined event to trigger a system reboot.
- **`lock`**: Predefined event to trigger locking the computer screen.
- **`sendAlert`**: Predefined event to send a system alert message.

#### Event: `execute`

**Description**: Executes a script using a specified executable (e.g., `node`, `python`, `bash`).

**Arguments**:

- `executable` (string): The executable used to run the script (e.g., `node`, `python`, `bash`).
- `args` (string): The arguments to include.
- `stdin` (string): The string to pipe to stdin.
- `password` (string): The admin password for authorization.

#### Event: `shutdown`

**Description**: Shuts down the system after a specified delay (in minutes). A notification is shown before shutting down.

**Arguments**:

- `password` (string): The admin password for authorization.
- `time` (number): The delay in minutes before shutdown.

**Example**:

```js
socket.on('shutdown', (password, time) => {
    socket.emit('shutdown', password, time)
})

socket.on('shutdown_result', (result) => {
    console.log(result)
})
```

### 3. **Predefined Scripts**

These predefined scripts perform common system operations. These events are available via **Socket.IO**.

#### Event: `reboot`

**Description**: Reboots the system immediately.

**Arguments**:

- `password` (string): The admin password for authorization.

#### Event: `sendAlert`

**Description**: Sends a custom system alert message.

**Arguments**:

- `password` (string): The admin password for authorization.
- `message` (string): The alert message to be sent.

## License

ScriptLauncher is an open-source project licensed under the MIT License. Feel free to use, modify, and distribute this software as per the terms of the license.
Contact

For any questions or support, feel free to reach out through GitHub Issues.
