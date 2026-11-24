# Better Agnostr Chromium 1.1.6 — pre-release

**Chromium port at feature parity with Firefox 1.1.6: the custom Better Agnostr and About settings panes now open correctly on mobile.**

## Fixed

- **Better Agnostr** and **About** now open from the settings list on mobile.
- Custom panes use Agnostr's native detail transition, so they render in the visible pane.
- The settings back button returns to the normal settings list.
- The mobile settings header shows **Better Agnostr** or **About** while those panes are open.
- Opening **Better Agnostr** from the Agnostr Suite footer now closes the launcher on mobile.
- Native settings sections continue to work normally.

## Install

1. Download and unzip `better-agnostr-1.1.6-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
