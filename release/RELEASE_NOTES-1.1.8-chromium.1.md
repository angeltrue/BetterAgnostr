# Better Agnostr Chromium 1.1.8 — pre-release

**Chromium port at feature parity with Firefox 1.1.8: duplicate suite buttons are removed, and the master switch now fully pauses the extension.**

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

## Install

1. Download and unzip `better-agnostr-1.1.8-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
