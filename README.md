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

A Firefox extension for **agnostr.com** that adds:

- a per-message **JSON event viewer** built into the message action bar;
- a **Glub.chat line/flair studio** that stamps compatible `glub` metadata with the live build stamp;
- **client-tag spoofing**, configured per Nostr event type;
- a **privacy scrubber** with a review-before-signing dialog;
- **voice/video call blocking** and call-UI hiding;
- all **Glub.chat themes** integrated into Agnostr's theme picker;
- **12 retro message chimes and 12 retro client click sounds**, with per-event chime toggles;
- **Hug / Slap / Custom action** items in the message right-click menu;
- a **categorized emoji picker** with 2,300+ base emoji for the composer;
- **custom fonts** (three sans and seven serif families bundled, plus popular system families and custom family/URL);
- a small **BA** plaque next to Better Agnostr usernames; client borders remain Agnostr's own;
- Locate Me removal, teleport-tag omission, voice-memo removal, call-button blocking, and a simplified app shell.

Everything runs locally. The extension does not have a server, does not send your keys anywhere, and stores settings in `browser.storage.local`.

## Install (temporary / development)

Firefox release builds only load unsigned add-ons temporarily.

1. Run `node build.mjs` in this directory.
2. Open Firefox → `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist/manifest.json`.
4. Open or reload <https://agnostr.com/>.

For a reproducible launch with `web-ext`:

```bash
npm install
npx web-ext run --source-dir dist
```

The add-on uses `world: "MAIN"` for its page-side hook, which requires Firefox 128 or newer.

## Using it

### Message JSON viewer

Hover a message row and click the `{ }` button in its action bar.

The viewer shows:

- the signed event JSON;
- a tag table;
- a generated `npub` / `nevent`;
- signature verification through nostr-tools in the page;
- relay frames observed for that event;
- a Glub line/flair preview when the event carries Glub metadata.

Older messages are reconstructed from Agnostr's local message store when the raw relay event is no longer in memory. Stored tags are preserved, so Glub flair and formatted lines survive a page reload. Those reconstructed rows are marked as unsigned.

### Glub line and flair

Open **Agnostr Settings → Better Agnostr → line** (or use the **Better Agnostr** entry in the Agnostr Suite, or the floating button on mobile).

- **Line format** supports glub's `&` codes: `&l` bold, `&o` italic, `&n` underline, `&m` strike, `&k` obfuscate, `&g` rainbow, `&r` reset, and the `&0`–`&f` colors.
- Placeholders are `{name}`, `{tag}`, and `{msg}`. A template without `{msg}` gets the message appended by glub.
- **Flair** is one of glub's ambient row effects: fire, lightning, stars, rain, plume, neon, matrix, sonar, fireflies, bubbles, aurora, bitcoin, glitch, or sol.
- `sol` is gated by glub.chat's own NIP-05 rule. The extension can stamp it, but glub readers only draw it for eligible keys.
- The **live glub.chat build stamp** is fetched from `https://glub.chat/` and inserted as the `v` field of the `glub` tag. glub drops metadata from an unknown build, so this field matters. If auto-sync fails, set a manual stamp in storage or let the background cache recover it.
- Incoming Glub flair and rich text can also be rendered directly in Agnostr rows.
- Line-template colours are applied to the Agnostr author name and message text. A colour before `{name}` colours the author; a colour before `{msg}` colours the message body.
- The line/flair preview applies the template, the selected flair, `&g` rainbow (with the flair’s own palette), and `&k` obfuscation. Rainbow motion runs right-to-left.
- `&k` obfuscation is deliberately sparse: a short burst flickers one or two glyphs rapidly, then the text rests unchanged for several seconds.

Outgoing chat events are changed **before signing** by hooking the page's signer. The resulting event id and signature are correct.

### Client spoofing

Choose a client tag value and a policy per event group:

- **leave** keeps whatever `client` tag the event already has;
- **spoof** replaces it with your chosen value;
- **strip** removes the tag entirely.

The default is to spoof chat messages as `BetterAgnostr`. Selecting `glub.chat` also stamps the live glub build so glub.chat does not hide the event. If the build is unknown, the spoof is left alone for that event rather than making it invisible on glub. The native **Broadcast Agnostr client** switch is disabled and hidden; these policies are the single client-tag control.

Some DM and mesh events are sealed with ephemeral keys. Those cannot be rewritten without the ephemeral key; they are left unchanged.

### Privacy

- **Calls & video:** disables incoming/outgoing call signals, blocks outgoing call events, removes Room Info call buttons, and hides group-call stages, floating call bars, ringing banners, voice-room rows, and call recording pills. Voice memos are unaffected by call blocking; the separate **Remove voice memo** privacy setting hides the composer button.
- **Metadata scrubber:** removes selected tags from every outgoing event (routing tags are always kept), and strips `utm_*`, `fbclid`, `si`, `igshid`, and similar tracking parameters from links.
- **Review before signing:** holds selected event groups before signing and shows every tag. Check a tag to remove it, then send or cancel. Critical routing tags and the `glub` tag are protected from removal; the `client` tag can be removed.
- **Locate Me:** hidden by default; toggle in **Settings → Privacy & Trust**.
- **Teleport:** omit the `t=teleport` tag from outgoing events in **Settings → Privacy & Trust**. This is enabled by default. The tag is removed before signing and checked again on the final signed frame before it reaches a relay. When omission is on, the visual TELEPORT badge on your own profile is hidden as well.

### Settings

**All Better Agnostr settings live in Agnostr Settings.** There is no separate extension side panel.

**Settings → Better Agnostr** has three tabs:

- **line** — template, colours, codes, flair, live preview, rendering toggles;
- **client** — client tag and per-event policies;
- **general** — suite-shortcut visibility, composer-panel state, and the custom action default.

**Settings → Privacy & Trust** gains a **Better Agnostr** group with Locate Me, teleport omission, voice-memo removal, tracking-parameter scrubbing, review-before-signing, call blocking, and tag-removal controls. Teleport omission and voice-memo removal are enabled by default. The native **Broadcast Agnostr client** switch is hidden because the Client tab now owns outgoing client tags.

**Settings → Notifications** gains **Better Agnostr sounds** directly below the native sound section: message-chime and UI-click presets, volume, chat/mention/DM/call toggles, UI clicks, and test buttons. The native **Message chimes** switch remains the on/off control for message chimes.

**Settings → About** is the last entry in the native navigation. It shows the Agnostr logo, an **Agnostr** label, the current web build, the current Better Agnostr version, Agnostr credits (hinsley + GitHub), and Better Agnostr credits (Angel + [github.com/angeltrue/BetterAgnostr](https://github.com/angeltrue/BetterAgnostr)). Angel is linked to the profile for `npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk` and opens that key in Agnostr’s own peer profile modal, using the same opener as clicking an avatar in chat.

**Settings → Appearance** includes:

- all twelve Glub.chat themes: Chat, Cyberpunk 2077, Blade Runner, Ex Machina, Giedi Prime, Matrix Neo, Star-Lord, Time Variance, Tron Legacy, Lumon Light, Her Light, and Iced Matcha Latte;
- a custom CSS box;
- a **Font** picker with bundled IBM Plex Sans, Atkinson Hyperlegible, Lexend, and seven serif families (Playfair Display, Cormorant Garamond, Libre Baskerville, Lora, Literata, Fraunces, Instrument Serif), popular system families, and custom family/URL support.

The native app rail is hidden. The **Agnostr Suite** button is available in every workspace header: Chat, Agora, Agmail, and Agwallet. On the groups page, a slim group switcher replaces the hidden app rail and keeps the suite button inline with the joined-group buttons and a create/join shortcut. The suite footer carries **Better Agnostr** next to **Settings**, so the settings shortcut is available on every page without a profile-footer button. The suite popover no longer carries duplicate Map or Search utilities. Group conversations show a **Public chat** button in the conversation header, and the suite’s **Chat** card also leaves a group and returns to public chat. Agnostr’s own mobile-only footer actions remain hidden.

The toolbar popup has an **Enable Better Agnostr** switch. Turning it off reloads the current Agnostr tab without the extension UI or outgoing-event changes; turning it back on reloads the tab with the extension active.


Better Agnostr users are marked with a small **BA** plaque next to their username in messages, the People list, the quick profile, and the peer profile. Client avatar borders are now owned by Agnostr itself; the extension no longer adds a green border.

The line preview is a real Agnostr-style row using your default identicon. It renders the Neuromancer “sky above the port” line through the template, flair palette, rainbow, and obfuscation pipeline. The old test-message input and build/native debug lines are gone. The Bitcoin flair now draws its circuit board and coin with a visible surge, and the stars flair keeps shooting stars inside the message line.


**Settings → Better Agnostr → general** also has:

- a compactness/collapse control for the composer formatting panel. The formatting panel is collapsed by default and opens from the small **Aa** button beside the composer.

The composer formatting panel no longer contains the line-editor or last-event shortcuts. It only carries the formatting controls and the colour picker. The composer has a separate emoji button that opens the categorized emoji grid. The grid groups emoji into Smileys, People, Nature, Food, Activities, Travel, Objects, Symbols, and Flags tabs. The category bar is a fixed header and the emoji grid scrolls underneath it without overlapping. The Better Agnostr settings tabs and buttons use the same segmented-control and button styling as native Agnostr.



Message flair effects are painted into a row-sized clipping layer, so stars, embers, circuits, and other effects cannot spill into adjacent messages. The hover action bar remains unclipped above the row and is cleared when the pointer leaves, so it cannot remain stuck. Room Info call buttons are removed entirely when call blocking is enabled.

The event viewer and custom action dialog use the client’s native sheet styling, with outlined controls, native typography, and segmented viewer tabs. The viewer’s Glub tab renders the exact same preview component as the settings preview: same avatar, name/tag, line, flair, and clipping.

Sounds are generated procedurally with the Web Audio API. The presets are retro hardware/software inspired: Macintosh, Sun Sparc, SGI IRIX, MSN Messenger, AOL, ICQ, Palm, BlackBerry, Blade Runner, Tron, Commodore 64, Amiga; and Model M, Mac mouse, Sun keyboard, SGI blip, MSN nudge, AOL chime, Palm tap, BlackBerry key, Blade Runner UI, Tron disc, C64 key, Amiga click.

### Right-click actions

Right-click any message for:

- **Hug** — sends `* hugs @name#tag *`
- **Slap** — sends `* slaps @name#tag with a large trout *`
- **Custom action…** — opens a native-styled dialog with a live preview. The final message uses the `* action *` format, e.g. `* boops @name#tag *`. The default text is editable in **Settings → Better Agnostr → general**; use `{user}` to place the mention yourself.

The menu repositions itself and scrolls when the added actions would otherwise run past the bottom of the window.

### Theme

The Glub.chat theme grid, font picker, and custom CSS box live in **Agnostr Settings → Appearance**. Selecting an Agnostr theme card clears the Glub override; selecting a glub theme card applies its CSS variables immediately.

## How it works

- `src/page.js` runs in the page's main world at `document_start`. It hooks `WebSocket`, records relay frames, and attaches to the Nostr signer through the React fiber tree. It signs only through the page's own signer; it does not implement a remote signer.
- `src/content.js` runs in the isolated content-script world. It owns the settings overlay, JSON viewer, Flair rendering, message actions, sounds, fonts, and composer toolbar.
- The two worlds communicate over a small `postMessage`/`CustomEvent` bridge.
- `src/background.js` fetches and caches the live glub.chat build stamp.
- If the signer hook cannot be attached, the page uses a local-key fallback for events whose key material is available in Agnostr's `localStorage`. That fallback can re-sign an event with the same key; events whose keys are not available are sent unchanged.

## Credits

Glub flair CSS/markup is adapted from glub.chat's own `flair.js` and stylesheet so the effects match on both clients. Glub theme colours are ported from glub.chat's theme blocks. Bundled fonts are IBM Plex Sans, Atkinson Hyperlegible, Lexend, Playfair Display, Cormorant Garamond, Libre Baskerville, Lora, Literata, Fraunces, and Instrument Serif under the SIL Open Font License (licences in `src/fonts/`). The in-app About page credits Agnostr to hinsley and Better Agnostr to Angel.

## Security notes

The page-world hook can read Agnostr's `localStorage`, including the same local signing material the site itself uses. It does this only to:

1. attach to the existing signer object in the page, and
2. provide the fallback re-signing path when that hook is unavailable.

The extension never transmits keys or event data off the machine. Its only automatic network request is a `GET https://glub.chat/` to read the public build stamp. A custom font URL entered by the user is loaded from that URL.

Client and Glub tags are public claims. Client spoofing is not cryptographic identity, and a gated flair is enforced by glub's reader, not by this extension.

## Development

```bash
npm install
node build.mjs       # writes dist/ and better-agnostr-1.1.3.zip
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
