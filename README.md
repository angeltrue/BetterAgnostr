# 🚨 STOP RIGHT THERE. READ THE WARNINGS. 🚨

## THIS BUILD IS UNSIGNED — FIREFOX WILL NOT KEEP IT

> [!WARNING]
> **This XPI has not been signed by Mozilla. Firefox Release and ESR will refuse to install it permanently.**
> Clicking “Allow” harder will not fix this. Use `about:debugging` for a temporary install, or send the ZIP to AMO and wait like everyone else.
> An unsigned XPI attached to a GitHub release is not a trust badge. If you install one from a stranger because the filename looked official, that is a you problem, not a Mozilla bug.
> The Chromium ZIP is an unpacked pre-release, not a store build. It lives behind Developer Mode. No, that is not a personality.

---

# 🚨 AI WROTE THIS. ACT LIKE IT. 🚨

## GENERATIVE AI WAS USED. THIS IS NOT A FLEX.

> [!CAUTION]
> **AI helped write this project. It is confident, fast, and occasionally completely wrong.**
> Do not give it your nsec, your sats, or a community you actually like without reading the code and testing the build yourself.
> “The AI said it was secure” is not an audit. “It worked on my machine” is not a test suite. “Just trust me” is not a threat model.
> No warranty. No support contract. No refunds. No adults are coming to fix this for you.

---

# Better Agnostr

A browser extension for **agnostr.com**: line and flair studio, client tags, privacy tools, Better Agnostr sounds, themes, and a JSON event viewer. Everything runs locally; no servers and no keys leave the browser.

> This branch is the Chromium port. The Firefox build lives on `main`.

## Features

- Line templates, `&` colour codes, rich text, and 14 flair effects.
- Glub/Bright rainbow toggle in Appearance.
- Client-tag leave/spoof/strip policies and client labels.
- Privacy scrubber, review-before-sign, teleport/timestamp/voice-memo hiding, and call blocking.
- 12 Better Agnostr chimes, UI clicks, volume, and chime triggers.
- JSON event viewer with tags, signatures, relay frames, and Glub previews.
- 12 Glub themes, custom CSS, and bundled fonts.
- Hug, slap, custom actions, `/me`, and a categorized emoji picker.

## Install

1. Run `npm install` and `node build.mjs`.
2. Firefox: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select `dist/manifest.json`.
3. Chromium 148+: open `chrome://extensions`, enable **Developer mode**, and load `release/better-agnostr-1.2.0-chromium.zip` unpacked.
4. Open or reload <https://agnostr.com/>.

Firefox 128 or newer is required. The unsigned XPI is in `release/`; permanent Firefox installation requires AMO signing.

## Use

Open **Agnostr Settings → Better Agnostr**. On mobile: **Apps → Settings**.

- `&l` bold, `&o` italic, `&n` underline, `&m` strike, `&k` obfuscate, `&g` rainbow, `&r` reset, `&0`–`&f` colours.
- Placeholders: `{name}`, `{tag}`, `{msg}`. A template without `{msg}` gets the message appended.
- Flairs: fire, lightning, stars, rain, plume, neon, matrix, sonar, fireflies, bubbles, aurora, bitcoin, glitch, sol.
- **Appearance → Glub rainbow:** on for glub.chat’s palette and motion, off for Bright.
- **Appearance → Hide notification button:** removes the Alerts shortcut from the rail and mobile tab bar.
- **Appearance:** Glub themes, rainbow toggle, notification-button toggle, custom CSS, fonts.
- **Client:** client tag and per-event leave/spoof/strip policies.
- **Privacy & Trust → Better Agnostr:** tag scrubbing, review before signing, Locate Me, timestamps, teleport, voice memos, and calls.
- **Notifications:** native notification controls plus Better Agnostr chimes and clicks. The new Alerts shortcut opens the same pane with those controls inline.

Outgoing chat events are rewritten **before signing**, so signatures stay valid. Sealed DM and mesh events cannot be rewritten.

## Build

```bash
npm install
node build.mjs
```

Source lives in `src/`; the build writes `dist/` and the versioned ZIP/XPI.
