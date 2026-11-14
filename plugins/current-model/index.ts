/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, For } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"

const MODEL_PICKER_COMMAND = "model.list"

type Logo = {
  color?: string
  art: readonly [string, string, string]
}

const LOGOS: Record<string, Logo> = {
  anthropic: { color: "#D97757", art: ["▄▀▀▀▄", "█▄▄▄█", "▀   ▀"] },
  openai: { color: "#10A37F", art: ["▄▀▀▀▄", "█   █", " ▀▀▀ "] },
  google: { color: "#4285F4", art: ["▄▀▀▀▀", "█  ▀█", " ▀▀▀ "] },
  opencode: { color: "#FAB283", art: ["█▀▀▀█", "█   █", "▀▀▀▀▀"] },
  "github-copilot": { color: "#8957E5", art: ["▄▀▀▀▀", "█    ", " ▀▀▀▀"] },
  xai: { art: ["▀▄ ▄▀", "  █  ", "▄▀ ▀▄"] },
  mistral: { color: "#FA520F", art: ["█▄ ▄█", "█ ▀ █", "▀   ▀"] },
  deepseek: { color: "#4D6BFE", art: ["█▀▀▄ ", "█  █ ", "▀▀▀  "] },
  openrouter: { color: "#6467F2", art: ["█▀▀▄ ", "█▀▀▄ ", "▀  ▀ "] },
}

const FALLBACK_LOGO: Logo = { art: ["▄▀▀▀▄", "█ ▄ █", "▀▄▄▄▀"] }

function logoFor(...ids: Array<string | undefined>): Logo {
  for (const id of ids) {
    if (id && LOGOS[id]) return LOGOS[id]
  }
  return FALLBACK_LOGO
}

function openModelPicker(context: Plugin.Context) {
  const reachable = context.keymap.commands().some((command) => command.id === MODEL_PICKER_COMMAND)
  if (!reachable) {
    context.ui.toast.show({ variant: "warning", message: "Current Model: model picker is not available here" })
    return
  }
  context.keymap.dispatch(MODEL_PICKER_COMMAND)
}

function View(props: { sessionID: string }) {
  const context = usePlugin()
  const theme = () => context.theme
  const session = createMemo(() => context.data.session.get(props.sessionID))
  const location = createMemo(() => {
    const directory = session()?.location.directory
    return directory ? { directory } : context.location ?? context.data.location.default()
  })

  createEffect(() => {
    void context.data.location.model.sync(location())
  })
  createEffect(() => {
    void context.data.location.provider.sync(location())
  })

  const current = createMemo(() => context.ui.model.current())
  const model = createMemo(() => {
    const selected = current()
    if (!selected) return undefined
    return (context.data.location.model.list(location()) ?? []).find(
      (item) => item.providerID === selected.providerID && (item.modelID === selected.modelID || item.id === selected.modelID),
    )
  })
  const provider = createMemo(() => {
    const selected = current()
    if (!selected) return undefined
    return (context.data.location.provider.list(location()) ?? []).find((item) => item.id === selected.providerID)
  })

  const modelName = createMemo(() => model()?.name ?? current()?.modelID ?? "No model selected")
  const providerName = createMemo(() => provider()?.name ?? current()?.providerID ?? "")
  const logo = createMemo(() => logoFor(current()?.providerID, provider()?.canonical, model()?.canonical))
  const [hovered, setHovered] = createSignal(false)
  const accent = () => logo().color ?? theme().text.base

  return (
    <box
      flexDirection="row"
      gap={2}
      onMouseUp={() => openModelPicker(context)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <box flexShrink={0}>
        <For each={logo().art}>{(line) => (
          <text selectable={false} fg={accent()}>{line}</text>
        )}</For>
      </box>
      <box flexGrow={1} minWidth={0}>
        <text
          selectable={false}
          fg={hovered() ? theme().text.action.primary.base : theme().text.base}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
        >
          {modelName()}
        </text>
        <text selectable={false} fg={accent()} wrapMode="none">{providerName()}</text>
        <text selectable={false} fg={theme().text.muted} wrapMode="none">
          {hovered() ? "click to switch" : current()?.variant ? `variant: ${current()?.variant}` : ""}
        </text>
      </box>
    </box>
  )
}

export default Plugin.define({
  id: "streetturtle.current-model",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (input) => <View sessionID={input.sessionID} />,
    })
  },
})
