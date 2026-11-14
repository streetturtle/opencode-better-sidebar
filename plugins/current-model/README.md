# @streetturtle/opencode-current-model

OpenCode sidebar plugin that shows the currently selected model and provider.

## What it shows

- A small ASCII logo of the provider in its brand color (generic logo for unknown providers)
- The selected model name, the provider name, and the variant when one is set
- Click the section to open the built-in model picker (same as <kbd>leader</kbd>+<kbd>m</kbd>)

```
▄▀▀▀▄  Claude Opus 4.5
█▄▄▄█  Anthropic
▀   ▀  variant: high
```

## Install

Requires OpenCode 2.0 or newer.

```sh
opencode plugin add @streetturtle/opencode-current-model
```

Project-only: add `"@streetturtle/opencode-current-model"` to `plugins` in `opencode.jsonc`.
