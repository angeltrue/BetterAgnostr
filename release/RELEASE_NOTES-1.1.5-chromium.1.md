# Better Agnostr Chromium 1.1.5 — pre-release

**Chromium port at feature parity with Firefox 1.1.5: call controls are fully removed when blocked, the group switcher supports the current groups layout, and the mobile UI is cleaner.**

## Fixed

- Room Info call sections are removed entirely while call blocking is enabled.
- Call action buttons, sheet actions, and reaction/context-menu call items are hidden immediately with CSS.
- A capture click blocker prevents late-rendered call controls from being clicked.
- The redundant **Public chat** button is gone. The Agnostr Suite's **Chat** card still returns to public chat.
- The groups-page switcher now supports both the current group pane markup and the group-channel layout.
- The switcher refreshes after joined groups change.

## Mobile

- Hidden redundant Agnostr Suite triggers; the **Apps** tab remains the suite entry.
- Removed the floating Better Agnostr button that overlapped the composer.
- Renamed the **Bitchat** tab label to **Chat**.
- Room Info call controls stay hidden.

## Install

1. Download and unzip `better-agnostr-1.1.5-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
