# Better Agnostr Chromium 1.2.0 — pre-release

**First Chromium port of Better Agnostr, packaged as an unpacked Manifest V3 extension.**

## Chromium changes

- Added a Chromium Manifest V3 build with a service-worker background.
- Added `minimum_chrome_version: 148`, using the standard `browser` namespace and Promise-returning runtime messages.
- Kept the page-side signer/WebSocket hook in a MAIN-world content script.
- Added `chrome-extension:` support for bundled font URLs.
- Bundled fonts remain available to the page through `web_accessible_resources`.

## Install

1. Download and unzip `better-agnostr-1.2.0-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

The package is **not signed by the Chrome Web Store**. This is a pre-release for testing and local use. The Firefox build remains on the `main` branch.

## Known release notes

- Requires Chromium 148 or newer.
- Chrome Web Store review and signing are still pending.
- Existing Firefox release history remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
