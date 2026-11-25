# 🚨🚨🚨 **UNPACKED CHROMIUM PRE-RELEASE** 🚨🚨🚨

## **THIS CHROMIUM BUILD IS NOT IN THE CHROME WEB STORE YET.**

> [!WARNING]
> **The ZIP in this repository and its pre-releases is an unpacked Chromium extension, not a store-signed package.**
>
> **Load it through Developer mode for testing, local development, or manual review.**
>
> **Normal browser installations should wait for the Chrome Web Store release.**
>
> **Never assume an unpacked extension is safe just because it is attached to a release.**

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

A Chromium extension for **agnostr.com**. It adds a message event inspector, Glub formatting and flair, client-tag controls, privacy tools, and a more compact shell while keeping Agnostr's native look.

## Features

- **JSON event viewer** in every message action bar.
- **Glub.chat line and flair studio** with live preview and the current Glub build stamp.
- **Client-tag controls** with per-event policies.
- **Privacy tools** for tag scrubbing, review before signing, teleport omission, Locate Me, and voice memos.
- **Call blocking** and call-UI hiding.
- **No blocked-message run notices** in chats.
- **12 Glub themes**, a custom CSS box, and **10 bundled font families**.
- **12 message chimes and 12 UI click sounds**, generated with Web Audio.
- **Better Agnostr chimes** with alert-type filters and UI clicks. Agnostr's native notifications stay in place; its message chime is replaced.
- **Hug / Slap / Custom action** right-click commands.
- **Categorized emoji picker** with 2,300+ base emoji.
- A small **BA** plaque beside Better Agnostr usernames. Client avatar borders remain Agnostr's own.
- A simplified shell that keeps the native app rail, with workspace switching, groups, and the Agnostr Suite close at hand.

Everything runs locally. The extension has no server, does not send keys anywhere, and stores settings in `browser.storage.local`.

## Install

This branch is the Chromium port. The Firefox build remains on `main`.

1. Run `npm install` and `node build.mjs`.
2. Open `chrome://extensions` in Chrome, Edge, Brave, Vivaldi, or another Chromium browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `dist/`.
5. Open or reload <https://agnostr.com/>.

The packaged pre-release ZIP is in `release/`. It is an unpacked extension, not a Chrome Web Store package. Chromium 148 or newer is required.

### Development launch

```bash
npm install
npx web-ext run --source-dir dist --target chromium
```

The Chromium build uses the `browser` namespace and Promise-returning runtime messages available from Chrome 148. `world: "MAIN"` content scripts require Chromium 111+.

## Usage

### Event viewer

Hover a message and click the **`{ }`** button in its action bar. The viewer shows:

- the signed event JSON;
- a tag table;
- generated `npub` and `nevent` values;
- signature verification through nostr-tools;
- relay frames observed for that event;
- a Glub line/flair preview when the event carries Glub metadata.

Older messages are reconstructed from Agnostr's local message store when the raw relay event is no longer in memory. Stored tags are preserved, so Glub flair and formatting survive a reload. Reconstructed rows are marked as unsigned.

### Glub line and flair

Open **Agnostr Settings → Better Agnostr → line**, or use the **Better Agnostr** entry in the Agnostr Suite. On mobile, the Suite is available from the **Apps** tab.

- **Line format** supports glub's `&` codes: `&l` bold, `&o` italic, `&n` underline, `&m` strike, `&k` obfuscate, `&g` rainbow, `&r` reset, and `&0`–`&f` colours.
- Placeholders are `{name}`, `{tag}`, and `{msg}`. A template without `{msg}` gets the message appended.
- **Flair** includes fire, lightning, stars, rain, plume, neon, matrix, sonar, fireflies, bubbles, aurora, bitcoin, glitch, and sol.
- `sol` is gated by glub.chat's NIP-05 rule. The extension can stamp it, but glub readers only draw it for eligible keys.
- The live glub.chat build stamp is fetched from `https://glub.chat/` and written as the `v` field of the `glub` tag. glub drops metadata from an unknown build.
- Incoming Glub flair and rich text are rendered directly in Agnostr rows.
- A colour before `{name}` colours the author; a colour before `{msg}` colours the message body.
- The preview applies the template, selected flair, `&g` rainbow cycling, and `&k` obfuscation. Colours and rainbow leave emoji glyphs untouched.
- `&k` obfuscation works on usernames and message text. It is deliberately sparse: a short flicker of one or two glyphs, then several seconds of rest.

Outgoing chat events are changed **before signing** by hooking the page's signer, so the resulting event id and signature stay valid.

### Client tags

Choose a client tag value and a policy for each event group:

- **leave** keeps whatever `client` tag the event already has;
- **spoof** replaces it with your chosen value;
- **strip** removes the tag.

The default is to spoof chat messages as `BetterAgnostr`. Selecting `glub.chat` also stamps the live Glub build so glub.chat does not hide the event. If the build is unknown, the spoof is skipped for that event. The native **Broadcast Agnostr client** switch is hidden; these policies are the only client-tag control.

Some DM and mesh events are sealed with ephemeral keys. Those cannot be rewritten and are left unchanged.

### Privacy controls

- **Calls & video:** blocks incoming and outgoing call signals and events, removes Room Info call buttons, and hides call stages, floating bars, ringing banners, voice-room rows, and recording pills. Voice memos are unaffected.
- **Metadata scrubber:** removes selected tags from outgoing events while keeping routing tags, and strips tracking parameters such as `utm_*`, `fbclid`, `si`, and `igshid` from links.
- **Review before signing:** holds selected event groups and shows every tag. Check a tag to remove it, then send or cancel. Critical routing tags and the `glub` tag are protected.
- **Locate Me:** hidden by default.
- **Teleport:** omits the `t=teleport` tag from outgoing events. It is enabled by default, checked again on the final signed frame, and also hides the visual TELEPORT badge on your own profile.
- **Remove voice memo:** hides the composer voice-memo button. It is enabled by default.

These controls live under **Settings → Privacy & Trust → Better Agnostr**.

### Right-click actions

Right-click any message for:

- **Hug** — sends `* hugs @name#tag *`
- **Slap** — sends `* slaps @name#tag with a large trout *`
- **Custom action…** — opens a native-styled dialog with a live preview. The result uses the `* action *` format. Use `{user}` for the target and `{sender}` for your name; nothing is appended automatically. Typing `/me <text>` in the composer sends the same action format directly.

The menu repositions and scrolls when the added actions would run past the viewport.

### Composer and emoji

The composer formatting panel is collapsed by default and opens from the **Aa** button. It contains bold, italic, underline, strike, obfuscate, rainbow, reset, and the colour picker.

The separate emoji button opens a categorized grid with 2,300+ base emoji. The category bar stays fixed while the grid scrolls. Categories: Smileys, People, Nature, Food, Activities, Travel, Objects, Symbols, and Flags.

### Suite and groups

The native app rail is kept, so workspace switching, joined groups, settings, and the Agnostr Suite stay available. The suite's **Chat** card returns to public chat.

The suite footer carries **Settings** and **Better Agnostr** side by side, so the settings shortcut is available everywhere. Agnostr's mobile-only footer actions stay hidden.

### Sounds

Sounds are generated procedurally with the Web Audio API. Message chimes include Macintosh, Sun Sparc, SGI IRIX, MSN Messenger, AOL, ICQ, Palm, BlackBerry, Blade Runner, Tron, Commodore 64, and Amiga. UI clicks include Model M, Mac mouse, Sun keyboard, SGI blip, MSN nudge, AOL chime, Palm tap, BlackBerry key, Blade Runner UI, Tron disc, C64 key, and Amiga click.

**Settings → Notifications** keeps Agnostr's native notification, ringtone, vibration, and preview controls. Better Agnostr adds its own message chimes, UI clicks, volume, chime triggers, and test buttons, and replaces the native message chime.

### Themes and fonts

**Settings → Appearance** includes:

- all twelve Glub.chat themes: Chat, Cyberpunk 2077, Blade Runner, Ex Machina, Giedi Prime, Matrix Neo, Star-Lord, Time Variance, Tron Legacy, Lumon Light, Her Light, and Iced Matcha Latte;
- a custom CSS box;
- a font picker with IBM Plex Sans, Atkinson Hyperlegible, Lexend, Playfair Display, Cormorant Garamond, Libre Baskerville, Lora, Literata, Fraunces, and Instrument Serif, plus popular system families and a custom family/URL option.

Selecting an Agnostr theme card clears the Glub override. Selecting a Glub theme applies its variables immediately.

## Settings

All Better Agnostr settings live in Agnostr Settings.

- **Better Agnostr → line:** template, colours, codes, flair, live preview, rendering toggles.
- **Better Agnostr → client:** client tag and per-event policies.
- **Privacy & Trust → Better Agnostr:** Locate Me, teleport omission, voice-memo removal, tracking-parameter scrubbing, review before signing, call blocking, and tag removal.
- **Notifications:** Agnostr's native notification controls plus Better Agnostr chimes, chime triggers, UI clicks, volume, and tests.
- **Appearance:** Glub themes, custom CSS, and fonts.
- **About:** current web build, Better Agnostr version, and credits. Angel's credit opens the native peer profile for `npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk`.

The toolbar popup has an **Enable Better Agnostr** switch. Turning it off reloads every open Agnostr tab and fully pauses the extension: no UI, signer patching, call filtering, outgoing-event changes, status timers, or glub-build requests. Agnostr's own message chime and notification settings are restored while paused.

## How it works

- `src/page.js` runs in the page's main world at `document_start`. It hooks `WebSocket`, records relay frames, and attaches to the Nostr signer through the React fiber tree. It signs only through the page's own signer; it does not implement a remote signer.
- `src/content.js` runs in the isolated content-script world. It owns the settings overlay, JSON viewer, flair rendering, message actions, sounds, fonts, and composer toolbar.
- The two worlds communicate over a small `postMessage`/`CustomEvent` bridge.
- `src/background.js` fetches and caches the live glub.chat build stamp.
- If the signer hook cannot be attached, the page uses a local-key fallback when the key material is available in Agnostr's `localStorage`. Events without available keys are sent unchanged.

## Security notes

The page-world hook can read Agnostr's `localStorage`, including the same local signing material the site uses. It does this only to attach to the existing signer and to provide the fallback re-signing path.

The extension never transmits keys or event data off the machine. Its only automatic network request is a `GET https://glub.chat/` for the public build stamp. A custom font URL entered by the user is loaded from that URL.

Client and Glub tags are public claims. Client spoofing is not cryptographic identity, and gated flair is enforced by glub's reader, not by this extension.

## Development

```bash
npm install
node build.mjs       # writes dist/ and better-agnostr-1.1.9-chromium.zip
```

Source layout:

```
src/
  page.js          main-world hook: websocket, signer, event preparation
  content.js       isolated-world settings overlay and feature UI
  background.js    glub build cache
  popup.*          toolbar popup
  lib/glub.js        &-codes, templates, glub tag, flairs
  lib/glub-flair.js  exact Glub flair markup generators
  lib/emojis.js      categorized Unicode emoji data
  lib/themes.js      Glub theme palettes and Agnostr variable mapping
  lib/sounds.js      procedural retro sounds
  lib/settings.js    defaults and persistence shape
  fonts/             bundled OFL fonts
  ui/glub-flair.css  Glub flair CSS, adapted
  ui/panel.css       shadow-DOM modals, JSON viewer, toasts
  ui/page.css        page chrome, settings overlay, flairs, composer bar
```

The extension is intentionally unminified so it can be audited in `dist/`.

## Credits

Glub flair CSS and markup are adapted from glub.chat's own `flair.js` and stylesheet so effects match on both clients. Glub theme colours are ported from glub.chat's theme blocks.

Bundled fonts are IBM Plex Sans, Atkinson Hyperlegible, Lexend, Playfair Display, Cormorant Garamond, Libre Baskerville, Lora, Literata, Fraunces, and Instrument Serif under the SIL Open Font License. Licences are in `src/fonts/`.

The in-app About page credits Agnostr to hinsley and Better Agnostr to Angel.
