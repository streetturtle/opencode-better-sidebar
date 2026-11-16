# @streetturtle/opencode-open-in

OpenCode sidebar plugin with one-click IDE launch buttons for the current session.

<img src="https://raw.githubusercontent.com/streetturtle/opencode-better-sidebar/main/assets/open-in-screenshot.png" alt="Open In sidebar screenshot" width="520" />

## What it does

- Adds an **Open In** section to the sidebar
- Shows buttons for installed IDEs only (Zed, VS Code, Cursor)
- Opens the active session directory directly in your IDE

## Platforms

- **macOS**: detects installed apps and launches with `open -a` (Zed via its CLI).
- **Linux and WSL**: detects the `zed`, `code` and `cursor` CLI launchers on your `PATH` (`which`) and runs them with the session directory. On WSL, `code` and `cursor` resolve to the Windows shims, so the folder opens in your Windows IDE.
- **Native Windows**: detects the `code` CLI launchers on your `PATH` (`where`) and runs them with the session directory.

## Install

Requires OpenCode 2.0 or newer.

```sh
opencode plugin add @streetturtle/opencode-open-in
```

## Usage

Open any session and click the IDE button in the sidebar.

## Notes

- If a button is missing, the IDE was not detected as installed (on Linux/WSL/Windows, make sure its CLI is on `PATH`; in VS Code run "Shell Command: Install 'code' command in PATH" if needed)
