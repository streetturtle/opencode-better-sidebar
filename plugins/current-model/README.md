# @streetturtle/opencode-current-model

OpenCode sidebar plugin that shows the currently selected model and provider.

## What it shows

- The provider's initial as a small ASCII letter, in its brand color (a stable generated color for other providers)
- The selected model name, the provider name, and the variant when one is set
- Click the section to open the built-in model picker (same as <kbd>leader</kbd>+<kbd>m</kbd>)

```
▄▀█  Claude Opus 4.5
█▀█  Anthropic · high
```

## Install

Requires OpenCode 2.0 or newer.

```sh
opencode plugin add @streetturtle/opencode-current-model
```

Project-only: add `"@streetturtle/opencode-current-model"` to `plugins` in `opencode.jsonc`.
