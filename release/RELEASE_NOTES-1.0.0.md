# Better Agnostr 1.0.0

A Firefox extension for [agnostr.com](https://agnostr.com/) that adds a message JSON viewer, Glub line/flair tooling, client spoofing, privacy controls, call blocking, retro sounds, custom fonts, categorized emoji pickers, BetterAgnostr client marking, and more.

## Downloads

- `better-agnostr-1.0.0.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation. Use `about:debugging` for temporary installation, or sign through AMO.
- `better-agnostr-1.0.0.zip` — packaged source archive for AMO review/signing or manual inspection.

## Highlights

- Per-message signed-event JSON viewer.
- Glub-compatible line/flair rendering with right-to-left rainbow, contained effects, and scoped obfuscation bursts.
- Client spoofing, including a default BetterAgnostr client tag.
- Privacy scrubber, review-before-signing, call blocking/removal, Locate Me hiding, and teleport-tag control.
- Eleven Glub themes, three bundled fonts, popular system fonts, and custom font support.
- 12 retro message chimes and 12 UI click sounds.
- Hug, Slap, and custom actions using the `* action *` format.
- Composer, hover-reaction, and right-click emoji pickers with 2,300+ categorized base emoji.
- BetterAgnostr users marked with a green avatar border.
- Native-styled event viewer and custom action dialogs.
- Toolbar popup master enable/disable switch.

## Install

1. Download `better-agnostr-1.0.0.xpi`.
2. Open Firefox → `about:addons` → gear → **Install Add-on From File**.
3. If Firefox rejects the unsigned package, use `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** and select the XPI, or sign it through AMO first.
4. Open or reload <https://agnostr.com/>.

## Build from source

```bash
npm install
node build.mjs
```

Requires Firefox 128 or newer because the page bridge uses the `MAIN` content-script world.

## Security

Better Agnostr has no server and does not transmit private keys. It stores settings in `browser.storage.local`. Its only automatic external request is the public Glub build-stamp fetch.
