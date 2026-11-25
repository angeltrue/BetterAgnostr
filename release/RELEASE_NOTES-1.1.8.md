# Better Agnostr 1.1.8 — Toolbar cleanup and master switch

**This hotfix removes the duplicate Agnostr Suite buttons and makes the master switch fully pause Better Agnostr.**

## Changed

- Removed the Agnostr Suite shortcut buttons that were injected into workspace headers.
- The native app rail is now the only suite entry.
- The **Better Agnostr** shortcut in the Agnostr Suite footer remains available.

## Fixed

- **Enable Better Agnostr** now fully pauses the page bridge.
- No signer patching, call filtering, outgoing-event preparation, socket logging, or status timers run while paused.
- The background build refresher no longer requests glub.chat while paused.
- Toggling the switch reloads every open Agnostr tab.
- Restored the mobile **Chat** tab label after the Agnostr toolbar update.

## Downloads

- `better-agnostr-1.1.8.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.8.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
