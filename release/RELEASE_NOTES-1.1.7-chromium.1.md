# Better Agnostr Chromium 1.1.7 — pre-release

**Chromium port at feature parity with Firefox 1.1.7: Agnostr's native desktop app rail is restored after the latest Agnostr layout update.**

## Fixed

- Restored the native app rail and its workspace, group, suite, search, settings, install, and profile controls.
- Removed the rule that hid the entire rail.
- Removed the custom groups-page rail, which was duplicating the native rail after the update.
- The groups page now uses Agnostr's own group switcher and create/join controls.
- Kept the 1.1.6 mobile settings-pane fixes.

## Install

1. Download and unzip `better-agnostr-1.1.7-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
