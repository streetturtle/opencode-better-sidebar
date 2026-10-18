/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"

const MAX_MODEL_ROWS = 10
const INT_FORMATTER = new Intl.NumberFormat("en-US")

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function readCost(source: any): { value: number; present: boolean } {
  const candidates = [
    source?.cost,
    source?.info?.cost,
    source?.usage?.cost,
    source?.metrics?.cost,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return {
        value: candidate,
        present: true,
      }
    }
  }

  return {
    value: 0,
    present: false,
  }
}

function modelLabel(model: any): string {
  if (!model) return "unknown"
  if (typeof model === "string") return model
  const provider = model.providerID ?? model.provider ?? ""
  const id = model.id ?? model.modelID ?? ""
  if (provider && id) return `${provider}/${id}`
  return id || provider || "unknown"
}

function spentTokenCount(tokens: any): number {
  const input = safeNumber(tokens?.input)
  const output = safeNumber(tokens?.output)
  const reasoning = safeNumber(tokens?.reasoning)
  const cacheWrite = safeNumber(tokens?.cache?.write)
  return input + output + reasoning + cacheWrite
}

function formatInt(value: number): string {
  return INT_FORMATTER.format(Math.max(0, Math.round(value)))
}

function formatMoney(value: number): string {
  const v = Math.max(0, value)
  if (v === 0) return "$0.00"
  if (v < 0.01) return "<$0.01"
  if (v < 1) return `$${v.toFixed(3)}`
  return `$${v.toFixed(2)}`
}

function formatModelTotals(tokens: number, cost: number, showCost: boolean): string {
  if (showCost && cost > 0) return `${formatInt(tokens)} (${formatMoney(cost)})`
  return formatInt(tokens)
}

function shortModelLabel(label: string): string {
  if (label.length <= 28) return label
  return `${label.slice(0, 25)}...`
}

function View(props: { context: Context; sessionID: string }) {
  const { context } = props
  const [open, setOpen] = createSignal(false)
  const theme = () => context.theme
  const messages = createMemo(
    () => (context.data.session.message.list(props.sessionID) ?? []) as any[],
  )
  const session = createMemo(() => context.data.session.get(props.sessionID) as any)

  // Runs for the initial sessionID and again whenever the slot re-renders with
  // a different one, so a sidebar session switch always re-syncs even if the
  // host does not remount this component.
  createEffect(() => {
    const sessionID = props.sessionID
    void context.data.session.sync(sessionID).catch(() => {})
    void context.data.session.message.sync(sessionID).catch(() => {})
  })

  // message.sync() only loads the most recent page, and the host re-syncs
  // (truncating back to that page) after tool-using executions. `more()`
  // reactively reports whether unloaded history exists; whenever it does, page
  // the rest in so the per-model breakdown keeps covering the whole session.
  // `more`/`loadMore` exist on the runtime data layer but are not part of the
  // plugin Context type yet.
  const messageApi = context.data.session.message as {
    more?: (sessionID: string) => boolean
    loadMore?: (sessionID: string, options?: { all?: boolean; signal?: AbortSignal }) => Promise<void>
  }
  createEffect(() => {
    const sessionID = props.sessionID
    if (!messageApi.more?.(sessionID) || !messageApi.loadMore) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void messageApi.loadMore?.(sessionID, { all: true, signal: controller.signal }).catch(() => {})
  })

  const data = createMemo(() => {
    const tokenTotals = new Map<string, number>()
    const costTotals = new Map<string, number>()
    const seen = new Set<string>()

    for (const message of messages()) {
      const role = message?.role ?? message?.type
      if (role !== "assistant") continue

      const messageID = message?.id
      if (typeof messageID === "string" && seen.has(messageID)) continue
      if (typeof messageID === "string") seen.add(messageID)

      const tokenCount = spentTokenCount(message?.tokens)
      const messageCost = readCost(message)
      if (tokenCount <= 0 && !messageCost.present) continue

      const label = modelLabel(message?.model ?? message?.modelID)

      if (tokenCount > 0) {
        tokenTotals.set(label, (tokenTotals.get(label) ?? 0) + tokenCount)
      }

      if (messageCost.present) {
        costTotals.set(label, (costTotals.get(label) ?? 0) + messageCost.value)
      }
    }

    const perModel = [...new Set([...tokenTotals.keys(), ...costTotals.keys()])]
      .map((model) => ({
        model,
        tokens: tokenTotals.get(model) ?? 0,
        cost: costTotals.get(model) ?? 0,
      }))
      .sort((a, b) => b.tokens - a.tokens || b.cost - a.cost)

    // Header totals come from the session aggregates maintained by the server
    // (session.tokens / session.cost), which cover the whole session and are
    // unaffected by message paging. The message scan above is per-model detail.
    const totalTokens = spentTokenCount(session()?.tokens)
    const sessionCost = readCost(session())
    const totalCost = sessionCost.present
      ? sessionCost.value
      : safeNumber(context.data.session.cost(props.sessionID))
    const hasCost = sessionCost.present || totalCost > 0
    const hasPerModelCost = costTotals.size > 0

    return {
      totalTokens,
      totalCost,
      hasCost,
      hasPerModelCost,
      perModel,
    }
  })

  const show = createMemo(() => data().totalTokens > 0 || data().hasCost)
  const canExpand = createMemo(() => data().perModel.length > 0)

  return (
    <Show when={show()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => canExpand() && setOpen((x) => !x)}>
          <Show when={canExpand()}>
            <text fg={theme().text.base}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text.base}>
            <b>Session Tokens</b>
          </text>
          <text fg={theme().text.muted}>{formatInt(data().totalTokens)}</text>
          <Show when={data().hasCost}>
            <text fg={theme().text.muted}> ({formatMoney(data().totalCost)})</text>
          </Show>
        </box>

        <Show when={canExpand() && open()}>
          <For each={data().perModel.slice(0, MAX_MODEL_ROWS)}>{(row) => (
            <box flexDirection="row">
              <text fg={theme().text.muted}>{shortModelLabel(row.model)}</text>
              <box flexGrow={1} />
              <text fg={theme().text.muted}>{formatModelTotals(row.tokens, row.cost, data().hasPerModelCost)}</text>
            </box>
          )}</For>
          <Show when={data().perModel.length > MAX_MODEL_ROWS}>
            <text fg={theme().text.muted}>+{data().perModel.length - MAX_MODEL_ROWS} more</text>
          </Show>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "streetturtle.session-tokens",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <View context={context} sessionID={sessionID} />,
    })
  },
})
