/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"

const BAR_WIDTH = 24

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)))
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function messageTokenCount(message: any): number {
  const input = safeNumber(message?.tokens?.input)
  const output = safeNumber(message?.tokens?.output)
  const reasoning = safeNumber(message?.tokens?.reasoning)
  const cacheRead = safeNumber(message?.tokens?.cache?.read)
  const cacheWrite = safeNumber(message?.tokens?.cache?.write)
  return input + output + reasoning + cacheRead + cacheWrite
}

function buildBar(percent: number): { bar: string; clamped: number } {
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((clamped / 100) * BAR_WIDTH)))
  return {
    bar: `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}`,
    clamped,
  }
}

function View(props: { sessionID: string }) {
  const context = usePlugin()
  const session = createMemo(() => context.data.session.get(props.sessionID))
  const location = createMemo(() => {
    const directory = session()?.location.directory
    return directory ? { directory } : context.location ?? context.data.location.default()
  })

  createEffect(() => {
    void context.data.session.message.sync(props.sessionID)
  })
  createEffect(() => {
    void context.data.location.model.sync(location())
  })

  const messages = createMemo(() => context.data.session.message.list(props.sessionID) as any[])
  const sessionCost = createMemo(() => {
    const fromSession = safeNumber(session()?.cost)
    if (fromSession > 0) return fromSession

    return messages()
      .filter((m) => m?.type === "assistant")
      .reduce((sum, m) => sum + safeNumber(m?.cost), 0)
  })

  const usage = createMemo(() => {
    const lastAssistant = messages().findLast((m) => {
      const output = safeNumber(m?.tokens?.output)
      return m?.type === "assistant" && output > 0
    })

    if (!lastAssistant) {
      return {
        tokens: 0,
        contextWindow: 0,
        percent: 0,
      }
    }

    const tokens = messageTokenCount(lastAssistant)
    const providerID = lastAssistant?.model?.providerID
    const modelID = lastAssistant?.model?.id
    const model = (context.data.location.model.list(location()) ?? []).find(
      (item) => item.providerID === providerID && (item.id === modelID || item.modelID === modelID),
    )
    const contextWindow = safeNumber(model?.limit?.context)
    const percent = contextWindow > 0 ? Math.round((tokens / contextWindow) * 100) : 0

    return {
      tokens,
      contextWindow,
      percent,
    }
  })

  const detailLine = createMemo(() => {
    const state = usage()
    const limitText = state.contextWindow > 0 ? formatInt(state.contextWindow) : "--"
    return `${formatInt(state.tokens)} / ${limitText} / ${formatMoney(sessionCost())}`
  })

  const theme = () => context.theme

  const progress = createMemo(() => {
    const percent = usage().percent
    const bar = buildBar(percent)
    const color = percent >= 90
      ? theme().text.feedback.error.base
      : percent >= 70
        ? theme().text.feedback.warning.base
        : theme().hue.accent[200]
    return {
      bar: bar.bar,
      color,
      percent: bar.clamped,
    }
  })

  return (
    <box>
      <text fg={theme().text.base} attributes={TextAttributes.BOLD}>Context</text>
      <box flexDirection="row" gap={1}>
        <text fg={progress().color}>{progress().bar}</text>
        <text fg={progress().color}> {progress().percent}%</text>
      </box>
      <text fg={theme().text.muted}>{detailLine()}</text>
    </box>
  )
}

export default Plugin.define({
  id: "streetturtle.context-progress",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (input) => <View sessionID={input.sessionID} />,
    })
  },
})
