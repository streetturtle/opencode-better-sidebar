/** @jsxImportSource @opentui/solid */
import { createSignal, For } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { platform } from "node:os"
import { spawn, spawnSync } from "node:child_process"
import { isAbsolute, resolve } from "node:path"
import { existsSync } from "node:fs"

type IDEAction = {
  label: string
  appName: string
  // CLI launcher name. macOS only uses it for Zed; Linux/WSL uses it for every IDE.
  command?: string
}

type IDEAvailability = "unknown" | "checking" | "available" | "missing"

const IDES: IDEAction[] = [
  { label: "Zed", appName: "Zed", command: "zed" },
  { label: "VS Code", appName: "Visual Studio Code", command: "code" },
  { label: "Cursor", appName: "Cursor", command: "cursor" },
]

const busyBySession = new Map<string, ReturnType<typeof createSignal<boolean>>>()
const availabilityByIDE = new Map<string, ReturnType<typeof createSignal<IDEAvailability>>>()

function getBusySignal(sessionID: string) {
  if (!busyBySession.has(sessionID)) busyBySession.set(sessionID, createSignal(false))
  return busyBySession.get(sessionID)!
}

function getAvailabilitySignal(appName: string) {
  if (!availabilityByIDE.has(appName)) {
    availabilityByIDE.set(appName, createSignal<IDEAvailability>("unknown"))
  }
  return availabilityByIDE.get(appName)!
}

function resolveZedCLIPath(): string | undefined {
  const which = spawnSync("which", ["zed"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  const fromPath = which.status === 0 ? which.stdout.trim() : ""
  const candidates = [
    fromPath,
    "/opt/homebrew/bin/zed",
    "/usr/local/bin/zed",
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate))
}

// Locate the IDE's CLI launcher on PATH. Windows uses `where` and may return
// a shell-script shim before the runnable .cmd/.exe, so prefer an executable.
function resolveCLIPath(command: string): string | undefined {
  const locator = platform() === "win32" ? "where" : "which"
  const result = spawnSync(locator, [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  if (result.status !== 0) return undefined
  const candidates = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (platform() === "win32") {
    const runnable = candidates.find((candidate) => /\.(exe|cmd|bat|com)$/i.test(candidate))
    if (runnable) return runnable
  }
  return candidates[0]
}

function launchWithCLI(cli: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = platform() === "win32"
      ? spawn("cmd.exe", ["/c", cli, targetPath], { detached: true, stdio: "ignore", windowsHide: true })
      : spawn(cli, [targetPath], { detached: true, stdio: "ignore" })
    child.once("error", reject)
    child.once("spawn", () => {
      child.unref()
      resolve()
    })
  })
}

function isSupportedPlatform(): boolean {
  return platform() === "darwin" || platform() === "linux" || platform() === "win32"
}

function checkIDEInstalled(ide: IDEAction): boolean {
  if (platform() !== "darwin") {
    return Boolean(ide.command && resolveCLIPath(ide.command))
  }

  if (ide.command === "zed") {
    return Boolean(resolveZedCLIPath())
  }

  const result = spawnSync("open", ["-Ra", ide.appName], { stdio: "ignore" })
  return result.status === 0
}

function refreshIDEAvailability() {
  if (!isSupportedPlatform()) {
    for (const ide of IDES) {
      const [, setAvailability] = getAvailabilitySignal(ide.appName)
      setAvailability("missing")
    }
    return
  }

  for (const ide of IDES) {
    const [, setAvailability] = getAvailabilitySignal(ide.appName)
    setAvailability("checking")
  }

  for (const ide of IDES) {
    const [, setAvailability] = getAvailabilitySignal(ide.appName)
    setAvailability(checkIDEInstalled(ide) ? "available" : "missing")
  }
}

async function openInIDE(context: Plugin.Context, sessionID: string, ide: IDEAction) {
  const [busy, setBusy] = getBusySignal(sessionID)
  if (busy()) return

  setBusy(true)

  try {
    if (!isSupportedPlatform()) {
      throw new Error("Open In supports macOS, Linux/WSL, and Windows")
    }

    const [availability, setAvailability] = getAvailabilitySignal(ide.appName)
    if (availability() !== "available") {
      const installed = checkIDEInstalled(ide)
      setAvailability(installed ? "available" : "missing")
      if (!installed) {
        return
      }
    }

    const info = context.data.session.get(sessionID) ?? await context.client.session.get({ sessionID })
    const rawPath = info?.subpath?.trim()
    const sessionDirectory = info?.location?.directory?.trim()
      || context.location?.directory?.trim()
      || context.data.location.default().directory?.trim()

    const targetPath = rawPath
      ? (isAbsolute(rawPath) ? rawPath : resolve(sessionDirectory ?? ".", rawPath))
      : sessionDirectory

    if (!targetPath) {
      throw new Error("Could not resolve session directory")
    }

    if (platform() !== "darwin") {
      const cli = ide.command ? resolveCLIPath(ide.command) : undefined
      if (!cli) throw new Error(`${ide.label} CLI not found on PATH`)
      await launchWithCLI(cli, targetPath)
      return
    }

    const launchResult = ide.command === "zed"
      ? (() => {
          const zed = resolveZedCLIPath()
          if (!zed) throw new Error("Zed CLI not found")
          return spawnSync(zed, [targetPath], { stdio: "ignore" })
        })()
      : spawnSync("open", ["-a", ide.appName, targetPath], { stdio: "ignore" })

    if (launchResult.error) {
      throw launchResult.error
    }
    if ((launchResult.status ?? 1) !== 0) {
      throw new Error(`Failed to open in ${ide.label}`)
    }
  } catch (err: any) {
    const text = err?.message ?? String(err)
    context.ui.toast.show({
      variant: "error",
      message: `Open In: ${text}`,
    })
  } finally {
    setBusy(false)
  }
}

function IDEButton(props: {
  sessionID: string
  ide: IDEAction
}) {
  const context = usePlugin()
  const [busy] = getBusySignal(props.sessionID)
  const theme = () => context.theme
  const disabled = () => busy()

  return (
    <text
      fg={disabled() ? theme().text.muted : theme().text.base}
      attributes={TextAttributes.BOLD}
      onMouseDown={() => {
        if (!disabled()) {
          void openInIDE(context, props.sessionID, props.ide)
        }
      }}
    >
      [{props.ide.label}]
    </text>
  )
}

function View(props: {
  sessionID: string
}) {
  const context = usePlugin()
  const installedIDEs = () => IDES.filter((ide) => getAvailabilitySignal(ide.appName)[0]() === "available")
  const theme = () => context.theme

  return (
    <box>
      <text fg={theme().text.base} attributes={TextAttributes.BOLD}>Open In</text>
      <box flexDirection="row" gap={1}>
        <For each={installedIDEs()}>{(ide) => (
          <IDEButton sessionID={props.sessionID} ide={ide} />
        )}</For>
      </box>
    </box>
  )
}

export default Plugin.define({
  id: "streetturtle.open-in",
  setup(context) {
    refreshIDEAvailability()

    context.ui.slot({
      append: "sidebar.content",
      render: (input) => <View sessionID={input.sessionID} />,
    })
  },
})
