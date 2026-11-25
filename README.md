# 🚨🚨🚨 **UNSIGNED BUILD WARNING** 🚨🚨🚨

## **THE XPI IN THIS REPOSITORY AND ITS RELEASES IS UNSIGNED.**

> [!WARNING]
> **Firefox Release and ESR will refuse to install this extension permanently unless it is signed by Mozilla.**
>
> **The files here are for temporary installation, local development, manual review, or AMO signing.**
>
> **To install permanently in standard Firefox, sign the package through addons.mozilla.org first.**
>
> **Never assume an unsigned XPI is safe just because it is attached to a release.**

---

# 🚨🚨🚨 **AI USAGE WARNING** 🚨🚨🚨

## **THIS PROJECT WAS BUILT WITH GENERATIVE AI ASSISTANCE.**

> [!CAUTION]
> **AI-generated code can be wrong, insecure, incomplete, or entirely fabricated.**
>
> **Do not install or trust this extension with keys, messages, or money without reviewing the source yourself.**
>
> **If you do not want AI-generated software, do not use this project.**
>
> **No warranty. Use at your own risk.**

---

# Better Agnostr

A Firefox extension for **agnostr.com**: event inspector, Glub line and flair studio, client tags, privacy tools, Better Agnostr chimes, and a compact native-looking shell.

## Features

- **JSON event viewer** with tags, signatures, relay frames, and Glub previews.
- **Glub line/flair studio** with live preview, themes, and the live Glub build stamp.
- **Client-tag controls** with leave, spoof, and strip policies.
- **Privacy tools** for tag scrubbing, review before signing, teleport omission, Locate Me, timestamps, voice memos, and call blocking.
- **Better Agnostr chimes** with 12 message sounds, 12 UI clicks, volume, and chime triggers.
- **12 Glub themes**, custom CSS, and bundled fonts.
- **Better Agnostr badges** plus spoofed-client labels in chat and profiles.
- **Hug / Slap / Custom action** commands, including `/me <text>`.
- **Categorized emoji picker** with 2,300+ base emoji.
- **Full-width stars flair** with randomized shooting stars.
- **Glub rainbow toggle** in Appearance: on for glub.chat's original palette and motion, off for the bright rainbow.
- **Automatic settings backup** that survives extension updates and storage loss.
- Native app rail with workspace switching, groups, settings, and the Agnostr Suite.

Everything runs locally. The extension has no server, sends no keys anywhere, and stores settings in `browser.storage.local`.

## Install

1. Run `npm install` and `node build.mjs`.
2. Open Firefox → `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…** and select `dist/manifest.json`.
4. Open or reload <https://agnostr.com/>.

The unsigned XPI is in `release/`. Firefox 128 or newer is required. For Chromium 148+, load `release/better-agnostr-1.1.15-chromium.zip` as an unpacked extension. The Chromium manifest uses a stable key, so replacing the unpacked folder keeps the same extension ID and settings.

## Usage

### Event viewer

Hover a message and click **`{ }`**. The viewer shows event JSON, tags, generated `npub`/`nevent` values, signature verification, relay frames, and a Glub preview. Older messages are reconstructed from Agnostr's local store and marked unsigned.

### Line and flair

Open **Agnostr Settings → Better Agnostr**. On mobile, open **Apps → Settings**.

- `&l` bold, `&o` italic, `&n` underline, `&m` strike, `&k` obfuscate, `&g` rainbow, `&r` reset, `&0`–`&f` colours.
- Placeholders: `{name}`, `{tag}`, `{msg}`. A template without `{msg}` gets the message appended.
- Flairs: fire, lightning, stars, rain, plume, neon, matrix, sonar, fireflies, bubbles, aurora, bitcoin, glitch, and sol.
- Rainbow style is selectable under **Appearance → Glub rainbow**: on for glub.chat's palette and motion (default), off for the bright rainbow. Both leave emoji colours intact.
- `&k` obfuscates usernames and message text.
- `sol` is gated by glub.chat's NIP-05 rule.

Outgoing chat events are rewritten **before signing**, so signatures remain valid.

### Client tags

Set a client value and a policy per event group:

- **leave** — keep the existing tag.
- **spoof** — replace it with your chosen value.
- **strip** — remove it.

Chat defaults to spoofing as `BetterAgnostr`. Selecting `glub.chat` also stamps the live Glub build. Unknown clients appear as a small plaque in chat and in the profile client pill; known BA users who spoof show **BA · client**. Sealed DM and mesh events cannot be rewritten.

### Privacy

- **Calls & video:** blocks call signals/events and hides call UI.
- **Metadata scrubber:** removes selected tags and tracking parameters.
- **Review before signing:** inspect and remove tags before sending.
- **Locate Me, timestamps, teleport, voice memo:** configurable visibility/omission. Timestamps are hidden only when enabled.

Controls live under **Settings → Privacy & Trust → Better Agnostr**.

### Right-click actions

- **Hug** — `* hugs @name#tag *`
- **Slap** — `* slaps @name#tag with a large trout *`
- **Custom action…** — live preview. `{user}` is the target, `{sender}` is you; nothing is appended automatically. `/me <text>` sends the same format from the composer.

### Composer and emoji

The **Aa** button opens bold, italic, underline, strike, obfuscate, rainbow, reset, and colours. The separate emoji button opens the categorized picker; its header stays fixed while the grid scrolls.

### Notifications and sounds

Agnostr keeps its native notifications, ringtone, vibration, and lock-screen preview controls. Better Agnostr replaces the native message chime and general sound-effects engine, and adds its own chime selection, UI clicks, volume, chime triggers, and test buttons under **Settings → Notifications**.

### Suite and groups

The native app rail is the single suite entry. The suite's **Chat** card returns to public chat, and the footer keeps **Settings** and **Better Agnostr** shortcuts. Better Agnostr settings has **Line** and **Client** tabs.

### Master switch

The toolbar popup's **Enable Better Agnostr** switch reloads every open Agnostr tab and pauses the extension, including signer hooks, call filtering, sounds, badges, and status timers. Native message chimes and notifications are restored while paused. Settings are mirrored to a local backup on agnostr.com and restored automatically if extension storage is lost or the extension ID changes.

## Settings

- **Better Agnostr → Line:** template, colours, codes, flair, preview, rendering.
- **Better Agnostr → Client:** client tag and per-event policies.
- **Privacy & Trust → Better Agnostr:** privacy and call controls.
- **Notifications:** native notification controls plus Better Agnostr chimes and clicks.
- **Appearance:** Glub themes, Glub rainbow toggle, custom CSS, fonts.
- **About:** web build, extension version, credits.

## Development

```bash
npm install
node build.mjs       # writes dist/ and better-agnostr-1.1.15.zip
```

Source layout:

```text
src/
  page.js          main-world hook: websocket, signer, event preparation
  content.js       isolated-world settings overlay and feature UI
  background.js    Glub build cache
  popup.*          toolbar popup
  lib/             Glub, themes, sounds, settings, emoji data
  ui/              page and settings styles
```

`page.js` runs in the page's main world at `document_start`, hooks `WebSocket`, and attaches to the signer through Agnostr's own signer. It never stores keys. `content.js` owns the settings overlay, viewer, flair, sounds, badges, and composer tools.

## Security notes

- Client and Glub tags are public claims, not cryptographic proof.
- Client spoofing does not provide anonymity.
- The XPI is unsigned unless signed through addons.mozilla.org.
- Review the source before trusting the extension with keys, messages, or money.
