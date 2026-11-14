/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"

const PREVIEW_LENGTH = 280

function latestUserPrompt(messages: any[]): string {
  let latest: any
  for (const message of messages) {
    if (message?.type !== "user") continue
    if (typeof message.text !== "string" || message.text.trim() === "") continue
    if (!latest || (message.time?.created ?? 0) >= (latest.time?.created ?? 0)) latest = message
  }
  return latest ? latest.text.trim() : ""
}

function preview(text: string): string {
  if (text.length <= PREVIEW_LENGTH) return text
  return `${text.slice(0, PREVIEW_LENGTH - 3).trimEnd()}...`
}

function View(props: { sessionID: string }) {
  const context = usePlugin()
  const [open, setOpen] = createSignal(false)
  const theme = () => context.theme

  createEffect(() => {
    void context.data.session.message.sync(props.sessionID)
  })

  const prompt = createMemo(() => latestUserPrompt(context.data.session.message.list(props.sessionID) as any[]))
  const canExpand = createMemo(() => prompt().length > PREVIEW_LENGTH)

  return (
    <Show when={prompt()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => canExpand() && setOpen((x) => !x)}>
          <Show when={canExpand()}>
            <text selectable={false} fg={theme().text.base}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text selectable={false} fg={theme().text.base}>
            <b>Current Prompt</b>
          </text>
        </box>
        <text fg={theme().text.muted} wrapMode="word">
          {open() ? prompt() : preview(prompt())}
        </text>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "streetturtle.current-prompt",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (input) => <View sessionID={input.sessionID} />,
    })
  },
})
