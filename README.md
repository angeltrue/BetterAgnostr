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

A Firefox extension for **agnostr.com**. It adds a message event inspector, Glub formatting and flair, client-tag controls, privacy tools, and a more compact shell while keeping Agnostr's native look.

## Features

- **JSON event viewer** in every message action bar.
- **Glub.chat line and flair studio** with live preview and the current Glub build stamp.
- **Client-tag controls** with per-event policies.
- **Privacy tools** for tag scrubbing, review before signing, teleport omission, Locate Me, and voice memos.
- **Call blocking** and call-UI hiding.
- **12 Glub themes**, a custom CSS box, and **10 bundled font families**.
- **12 message chimes and 12 UI click sounds**, generated with Web Audio.
- **Hug / Slap / Custom action** right-click commands.
- **Categorized emoji picker** with 2,300+ base emoji.
- A small **BA** plaque beside Better Agnostr usernames. Client avatar borders remain Agnostr's own.
- A simplified shell with the native app rail replaced by the Agnostr Suite and a groups-page switcher.

Everything runs locally. The extension has no server, does not send keys anywhere, and stores settings in `browser.storage.local`.

## Install

Firefox Release and ESR only load unsigned add-ons temporarily.

1. Run `npm install` and `node build.mjs`.
2. Open Firefox → `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist/manifest.json`.
4. Open or reload <https://agnostr.com/>.

The packaged XPI is in `release/`. It remains unsigned unless it is signed through addons.mozilla.org. Firefox 128 or newer is required.

### Development launch

```bash
npm install
npx web-ext run --source-dir dist
```

The add-on uses `world: "MAIN"` for its page-side hook, which requires Firefox 128 or newer.

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
- The preview applies the template, selected flair, `&g` rainbow palette, and `&k` obfuscation. Rainbow motion runs right-to-left.
- `&k` obfuscation is deliberately sparse: a short flicker of one or two glyphs, then several seconds of rest.

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
- **Custom action…** — opens a native-styled dialog with a live preview. The result uses the `* action *` format, e.g. `* boops @name#tag *`. Edit the default text in **Settings → Better Agnostr → general**; `{user}` places the mention yourself.

The menu repositions and scrolls when the added actions would run past the viewport.

### Composer and emoji

The composer formatting panel is collapsed by default and opens from the **Aa** button. It contains bold, italic, underline, strike, obfuscate, rainbow, reset, and the colour picker.

The separate emoji button opens a categorized grid with 2,300+ base emoji. The category bar stays fixed while the grid scrolls. Categories: Smileys, People, Nature, Food, Activities, Travel, Objects, Symbols, and Flags.

### Suite and groups

The native app rail is hidden. The **Agnostr Suite** button is available in every workspace header: Chat, Agora, Agmail, and Agwallet.

On the groups page, a slim switcher replaces the rail with joined groups, a create/join shortcut, and the suite button inline with the group buttons. The suite's **Chat** card returns to public chat.

The suite footer carries **Settings** and **Better Agnostr** side by side, so the settings shortcut is available everywhere. Agnostr's mobile-only footer actions stay hidden.

### Sounds

Sounds are generated procedurally with the Web Audio API. Message chimes include Macintosh, Sun Sparc, SGI IRIX, MSN Messenger, AOL, ICQ, Palm, BlackBerry, Blade Runner, Tron, Commodore 64, and Amiga. UI clicks include Model M, Mac mouse, Sun keyboard, SGI blip, MSN nudge, AOL chime, Palm tap, BlackBerry key, Blade Runner UI, Tron disc, C64 key, and Amiga click.

Volume, chat/mention/DM/call toggles, and test buttons are in **Settings → Notifications**. The native **Message chimes** switch remains the on/off control for message chimes.

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
- **Better Agnostr → general:** suite-shortcut visibility, composer-panel state, and the custom action default.
- **Privacy & Trust → Better Agnostr:** Locate Me, teleport omission, voice-memo removal, tracking-parameter scrubbing, review before signing, call blocking, and tag removal.
- **Notifications → Better Agnostr sounds:** presets, volume, event toggles, and tests.
- **Appearance:** Glub themes, custom CSS, and fonts.
- **About:** current web build, Better Agnostr version, and credits. Angel's credit opens the native peer profile for `npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk`.

The toolbar popup has an **Enable Better Agnostr** switch. Turning it off reloads the current Agnostr tab without the extension UI or outgoing-event changes.

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
node build.mjs       # writes dist/ and better-agnostr-1.1.6.zip
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
