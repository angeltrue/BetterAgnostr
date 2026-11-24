# Better Agnostr Chromium 1.1.2 — pre-release

**Chromium port of Better Agnostr at feature parity with the Firefox 1.1.2 release.**

## Chromium changes

- Chromium Manifest V3 build with a service-worker background.
- `minimum_chrome_version: 148`, using the standard `browser` namespace and Promise-returning runtime messages.
- Page-side signer/WebSocket hook kept in a MAIN-world content script.
- Added `chrome-extension:` support for bundled font URLs.
- Bundled fonts remain available to the page through `web_accessible_resources`.

## Install

1. Download and unzip `better-agnostr-1.1.2-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

The package is **not signed by the Chrome Web Store**. This is a pre-release for testing and local use. The Firefox build remains on the `main` branch.

## Known release notes

- Requires Chromium 148 or newer.
- Chrome Web Store review and signing are still pending.
- Existing Firefox release history remains on `main`.
- The earlier 1.2.0 Chromium pre-release was withdrawn because Chromium should match the Firefox 1.1.2 version.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
