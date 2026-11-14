/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"

const MODEL_PICKER_COMMAND = "model.list"

const BRAND_COLORS: Record<string, string> = {
  anthropic: "#D97757",
  openai: "#10A37F",
  google: "#4285F4",
  opencode: "#FAB283",
  "github-copilot": "#8957E5",
  mistral: "#FA520F",
  deepseek: "#4D6BFE",
  openrouter: "#6467F2",
}

function initial(name: string): string {
  return name.toUpperCase().match(/[A-Z0-9]/)?.[0] ?? "?"
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255).toString(16).padStart(2, "0")
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

function colorFor(...ids: Array<string | undefined>): string | undefined {
  for (const id of ids) {
    if (id && BRAND_COLORS[id]) return BRAND_COLORS[id]
  }
  const id = ids.find(Boolean)
  if (!id) return undefined
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hslToHex(hash % 360, 65, 65)
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
  const letter = createMemo(() => initial(providerName() || modelName()))
  const [hovered, setHovered] = createSignal(false)
  const accent = createMemo(
    () => colorFor(current()?.providerID, provider()?.canonical, model()?.canonical) ?? theme().text.base,
  )

  return (
    <box
      flexDirection="row"
      gap={2}
      onMouseUp={() => openModelPicker(context)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <ascii_font flexShrink={0} selectable={false} font="tiny" text={letter()} color={accent()} />
      <box flexGrow={1} minWidth={0}>
        <text
          selectable={false}
          fg={hovered() ? theme().text.action.primary.base : theme().text.base}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
        >
          {modelName()}
        </text>
        <Show
          when={!hovered()}
          fallback={<text selectable={false} fg={theme().text.muted} wrapMode="none">click to switch</text>}
        >
          <box flexDirection="row">
            <text selectable={false} fg={accent()} wrapMode="none">{providerName()}</text>
            <Show when={current()?.variant}>
              <text selectable={false} fg={theme().text.muted} wrapMode="none"> · {current()?.variant}</text>
            </Show>
          </box>
        </Show>
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
