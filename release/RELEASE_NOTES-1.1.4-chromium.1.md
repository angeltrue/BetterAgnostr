# Better Agnostr Chromium 1.1.4 — pre-release

**Chromium port at feature parity with Firefox 1.1.4: lower idle overhead, lighter memory history, and no Agnostr Suite menu flash.**

## Performance

- Filtered the page MutationObserver to relevant UI changes instead of every class change.
- Disconnected the observer during Better Agnostr's own DOM updates to stop feedback loops.
- Cached per-row decoration so unchanged message rows are skipped.
- Throttled call-control, Better Agnostr plaque, and Bitchat-label maintenance.
- Cached obfuscated-text targets instead of scanning the document every 70 ms.
- Deferred enhancement work while the tab is hidden.
- Reduced event and relay-log history caps to keep long sessions lighter.

## Suite menu

- Map and Search utilities are hidden with CSS before the suite appears.
- The Chat card renders as **Chat** immediately, without flashing “Bitchat”.
- The footer keeps a stable two-column layout while the Better Agnostr shortcut is added.

## Install

1. Download and unzip `better-agnostr-1.1.4-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
