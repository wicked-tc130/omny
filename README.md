# Omny

Omny is a focused desktop SSH client for managing a small set of servers without an account or cloud sync. It is a streamlined fork of [OmnySSH](https://github.com/timhartmann7/omnyssh).

## What remains

- Live host dashboard with CPU, RAM, disk, uptime, OS, processes, and detected services.
- Multiple independent SSH tabs, including several sessions to the same host.
- Per-host startup commands for bastion workflows such as `ssh -tt app@10.0.0.2 'sudo -iu developer'`.
- Two-pane SFTP browser.
- Editable manual hosts and read-only imports from `~/.ssh/config`.
- Persistent drag-and-drop host ordering, light/dark themes, and streamer mode.
- `⌘W` closes the active SSH/SFTP tab; `⌘K` opens host/session search.

The desktop app intentionally has no built-in updater, account, telemetry, automatic SSH-key setup, or snippets interface.

## Build the desktop app

Requirements: Rust, Node.js, npm, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
cd crates/omnyssh-gui/ui
npm ci
cd ..
cargo tauri build
```

On macOS the application bundle is written to:

```text
target/release/bundle/macos/Omny.app
```

For development:

```bash
cd crates/omnyssh-gui
cargo tauri dev
```

## Configuration

Omny keeps compatibility with the original OmnySSH configuration directory:

- macOS: `~/Library/Application Support/omnyssh/`
- Linux: `~/.config/omnyssh/`
- Windows: `%APPDATA%\omnyssh\`

Manual hosts are stored in `hosts.toml`. Passwords and private-key paths stay in the Rust backend and are not exposed to the webview.

## Workspace

```text
crates/omnyssh-core   shared SSH, metrics, configuration, and SFTP engine
crates/omnyssh        original terminal UI
crates/omnyssh-gui    Omny desktop app
```

The terminal UI remains in the workspace to preserve the upstream project structure, but Omny-specific work is concentrated in `crates/omnyssh-gui` and the shared core.

## Verification

```bash
cargo test --workspace

cd crates/omnyssh-gui/ui
npm run check
npm test
```

## License

Apache-2.0. See [LICENSE](LICENSE). Original project copyright and history are preserved in Git.
