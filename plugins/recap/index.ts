/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, Show } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { SyntaxStyle, TextAttributes } from "@opentui/core"

const PROMPTS_UNTIL_STALE = 3
const RECENT_MESSAGES = 10

// Module-level signals so the View component reacts to changes
const recapSignals = new Map<string, ReturnType<typeof createSignal<string | null>>>()
const loadingSignals = new Map<string, ReturnType<typeof createSignal<boolean>>>()
// Counts user prompts sent after the last recap was generated
const promptCounters = new Map<string, number>()

type RecapOptions = {
  providerID?: string
  modelID?: string
}

type ModelChoice = {
  providerID: string
  id: string
}

function readConfiguredModel(options: RecapOptions | undefined): ModelChoice | undefined {
  const providerID = options?.providerID?.trim()
  const modelID = options?.modelID?.trim()

  const hasProvider = Boolean(providerID)
  const hasModel = Boolean(modelID)

  if (hasProvider !== hasModel) {
    throw new Error("Invalid recap plugin config: set both providerID and modelID, or neither")
  }

  if (!hasProvider || !hasModel) return

  return {
    providerID: providerID!,
    id: modelID!,
  }
}

function inferSessionModel(messages: any[]): ModelChoice | undefined {
  const lastAssistant = [...messages]
    .reverse()
    .find((m: any) => {
      return m?.type === "assistant" && typeof m?.model?.providerID === "string" && typeof m?.model?.id === "string"
    })

  const providerID = lastAssistant?.model?.providerID?.trim?.() ?? ""
  const id = lastAssistant?.model?.id?.trim?.() ?? ""
  if (!providerID || !id) return

  return { providerID, id }
}

function messageText(message: any): string {
  if (message?.type === "user") return (message.text ?? "").trim()
  if (message?.type === "assistant") {
    return (message.content ?? [])
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text ?? "")
      .join(" ")
      .trim()
  }
  return ""
}

function getRecapSignal(sessionID: string) {
  if (!recapSignals.has(sessionID)) recapSignals.set(sessionID, createSignal<string | null>(null))
  return recapSignals.get(sessionID)!
}

function getLoadingSignal(sessionID: string) {
  if (!loadingSignals.has(sessionID)) loadingSignals.set(sessionID, createSignal<boolean>(false))
  return loadingSignals.get(sessionID)!
}

function buildSyntaxStyle(context: Plugin.Context): SyntaxStyle {
  const c = context.theme.syntax
  return SyntaxStyle.fromStyles({
    comment:     { fg: c.comment },
    keyword:     { fg: c.keyword },
    function:    { fg: c.function },
    variable:    { fg: c.variable },
    string:      { fg: c.string },
    number:      { fg: c.number },
    type:        { fg: c.type },
    operator:    { fg: c.operator },
    punctuation: { fg: c.punctuation },
  }, context.renderer.nativeScene)
}

function View(props: { session_id: string; onRecap: () => void }) {
  const context = usePlugin()
  const theme = () => context.theme
  const recap = () => getRecapSignal(props.session_id)[0]()
  const loading = () => getLoadingSignal(props.session_id)[0]()
  const syntaxStyle = createMemo(() => buildSyntaxStyle(context))

  return (
    <box>
      <text
        selectable={false}
        fg={theme().text.base}
        attributes={TextAttributes.BOLD}
        onMouseDown={() => { if (!loading()) props.onRecap() }}
      >
        {loading() ? "Generating..." : "Recap"}
      </text>
      <Show when={recap() !== null && !loading()}>
        <markdown
          content={recap()!}
          syntaxStyle={syntaxStyle()}
          fg={theme().text.muted}
        />
      </Show>
    </box>
  )
}

function setup(context: Plugin.Context) {
  const { client } = context
  const recapOptions = context.options as RecapOptions | undefined
  let configuredRecapModel: ModelChoice | undefined
  let optionsError: string | undefined

  try {
    configuredRecapModel = readConfiguredModel(recapOptions)
  } catch (err: any) {
    optionsError = err?.message ?? String(err)
  }

  // Track user prompts per session and clear stale recaps
  const stopExecutionListener = context.data.on("session.execution.started", (e) => {
    const sessionID = e.data.sessionID
    if (!sessionID) return
    const [recap] = getRecapSignal(sessionID)
    if (recap() === null) return

    const count = (promptCounters.get(sessionID) ?? 0) + 1
    promptCounters.set(sessionID, count)
    if (count >= PROMPTS_UNTIL_STALE) {
      const [, setRecap] = getRecapSignal(sessionID)
      setRecap(null)
      promptCounters.set(sessionID, 0)
    }
  })

  async function generateRecap(sessionID: string) {
    const [, setRecap] = getRecapSignal(sessionID)
    const [, setLoading] = getLoadingSignal(sessionID)
    const abort = new AbortController()
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    setLoading(true)

    const [currentRecap] = getRecapSignal(sessionID)
    const previousRecap = currentRecap()

    try {
      if (optionsError) {
        throw new Error(optionsError)
      }

      // Use only the most recent user and assistant messages
      await context.data.session.message.sync(sessionID)
      const allMessages = context.data.session.message.list(sessionID) as any[]
      const messages = allMessages
        .filter((m) => m?.type === "user" || m?.type === "assistant")
        .slice(-RECENT_MESSAGES)

      const transcript = messages
        .map((m: any) => {
          const text = messageText(m)
          return text ? `${m.type}: ${text}` : null
        })
        .filter(Boolean)
        .join("\n\n")

      if (!transcript) {
        setRecap("*Nothing to summarize yet.*")
        return
      }

      const modelToUse = configuredRecapModel ?? inferSessionModel(allMessages)

      const prompt = `You are a summarization assistant. Output only Markdown - no tools, no files, no questions.
Do not use Markdown tables.

Summarize this coding session in ~40 words across these sections:

**Working on:** one sentence - what is being built or explored
**Done:** max 2 bullets, <=6 words each (skip if nothing yet)
**Next:** max 1 bullet - the immediate next step (skip if none)

No intro, no outro, no extra sections. Output only the Markdown.
Never use table syntax (no pipes or table separators).
${previousRecap ? `\nPREVIOUS RECAP (context for earlier history):\n${previousRecap}\n` : ""}
RECENT TRANSCRIPT (last ${RECENT_MESSAGES} messages):
${transcript}`

      timeoutHandle = setTimeout(() => abort.abort(new Error("Recap timed out")), 30_000)

      const result = await client.generate.text(
        {
          prompt,
          ...(modelToUse ? { model: modelToUse } : {}),
        },
        { signal: abort.signal },
      )

      const recapText = (result?.text ?? "").trim()

      setRecap(recapText || "*No summary generated.*")
      promptCounters.set(sessionID, 0)

    } catch (err: any) {
      const reason = abort.signal.aborted ? abort.signal.reason : err
      setRecap(`*Error: ${reason?.message ?? String(reason)}*`)
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      setLoading(false)
    }
  }

  context.ui.slot({
    append: "sidebar.content",
    render: (input) => (
      <View
        session_id={input.sessionID}
        onRecap={() => generateRecap(input.sessionID)}
      />
    ),
  })

  return () => stopExecutionListener()
}

export default Plugin.define({
  id: "streetturtle.recap",
  setup,
})
