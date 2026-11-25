# Changelog

All notable changes to Better Agnostr are documented here.

## 1.1.10 — Rainbow, stars, and client labels

- Fixed flair-coloured `&g` rainbow text falling back to white.
- Reversed rainbow motion to run left-to-right.
- Added darker text contrast behind flair-coloured rainbows.
- Kept emoji glyphs untouched by rainbow and colour effects.
- Extended the stars flair field across the full message row.
- Added 1–3 randomized shooting stars at different positions per trigger.
- Reapplied the BA plaque on every chat refresh so it no longer disappears after a re-render.
- Added spoofed-client labels in chat, including **BA · client** for known Better Agnostr users.
- Reused known Better Agnostr peers for chat badges, matching the profile badge.
- Combined Firefox and Chromium downloads into one release entry.
- Mirrored settings to a local agnostr.com backup and restored them after extension storage loss or an extension-ID change.
- Added a stable Chromium manifest key so unpacked updates keep the same extension ID.
- Compressed the README without changing the warning blocks.

## 1.1.9 — Chimes, line effects, and custom actions

- Kept Agnostr's native notifications, ringtone, vibration, and lock-screen controls.
- Replaced only Agnostr's native message chime with Better Agnostr's procedural chimes and UI clicks.
- Styled the Better Agnostr sound controls with Agnostr's native section, row, switch, select, and button styling.
- Restored Agnostr's native message chime when Better Agnostr is paused.
- Fixed obfuscation formatting for usernames in line templates.
- Fixed colour and rainbow line effects overriding emoji rendering.
- Removed the **General** tab from Better Agnostr settings.
- Removed the obsolete Better Agnostr shortcut-visibility setting.
- Moved custom-action text out of settings and into the custom-action dialog.
- Custom actions no longer append a username automatically.
- Added `{sender}` and `{user}` placeholders with paste buttons in the custom-action dialog.
- Added `/me <text>` composer command support for custom actions.
- Removed the "X blocked message(s)" run notices from chats while Better Agnostr is active.

## 1.1.8 — Toolbar cleanup and master switch

- Removed the Agnostr Suite buttons that Better Agnostr injected into workspace headers; the native app rail is now the single suite entry.
- Kept the **Better Agnostr** shortcut in the Agnostr Suite footer.
- Fixed the **Enable Better Agnostr** switch so it fully pauses the page bridge.
- Disabled call filtering, signer patching, outgoing-event preparation, status timers, and socket logging while paused.
- The background build refresher now stops requesting glub.chat while paused.
- Toggling the master switch reloads every open Agnostr tab.
- Restored the mobile **Chat** tab label after the Agnostr toolbar update.

## 1.1.7 — Restore the native app rail

- Restored Agnostr's native desktop app rail after the latest Agnostr layout update.
- Removed the rule that hid the entire rail, which was also removing workspace, group, settings, profile, and suite controls.
- Removed the custom groups-page rail so the native rail is the only switcher.
- The groups page now uses Agnostr's own group buttons without a duplicate rail.
- Kept the Better Agnostr and About settings-pane fixes from 1.1.6.

## 1.1.6 — Mobile settings panes

- Fixed **Better Agnostr** and **About** not opening from the settings list on mobile.
- The custom settings panes now open Agnostr's detail view through its native navigation before rendering.
- Returning from a custom pane restores the normal settings list.
- The mobile settings header now shows **Better Agnostr** or **About** instead of the previously selected native section.
- The Agnostr Suite launcher now closes when opening **Better Agnostr** from its footer on mobile.

## 1.1.5 — Call cleanup, mobile polish, and group switcher

- Removed Room Info call sections and call action buttons entirely while call blocking is enabled.
- Added immediate CSS hiding and a capture click blocker for call controls that render late.
- Removed the redundant **Public chat** button. Use the Agnostr Suite's **Chat** card instead.
- Fixed the groups-page switcher for Agnostr's current group pane layout and refreshed it after group changes.
- Mobile: hid the redundant suite triggers and floating BA button.
- Mobile: renamed the **Bitchat** tab label to **Chat**.
- Mobile: keeps the Room Info call section hidden and the composer free of the floating shortcut.

## 1.1.4 — Performance and suite menu flash

- Cut idle content-script work by filtering the page MutationObserver to relevant UI changes.
- Paused the observer during the extension's own DOM updates to prevent feedback loops.
- Cached per-row decoration so unchanged message rows are not reprocessed.
- Throttled call-control, Better Agnostr plaque, and Bitchat-label maintenance work.
- Cached obfuscated-text targets instead of scanning the whole document every 70 ms.
- Deferred enhancement work while the tab is hidden.
- Reduced event and relay-log memory caps to keep long sessions lighter.
- Prevented the Agnostr Suite from flashing its old Map/Search utilities and Bitchat label by normalizing them with CSS before first paint.

## 1.1.3 — Client plaques, teleport visuals, and hover cleanup

- Replaced the extension's green Better Agnostr avatar border with a small **BA** plaque next to usernames.
- Let Agnostr's own client-indicator borders remain the only avatar borders.
- Added the **BA** plaque to messages, the People list, the quick profile, and the peer profile.
- Hid the visual TELEPORT badge on your own profile when teleport-tag omission is enabled.
- Fixed message hover action menus getting stuck by clearing stale `actions-open`/`picker-open` state and focus.
- Cleared hover state after the event viewer, Hug, Slap, and custom actions.

## 1.1.2 — Privacy defaults, context-menu stability, and Chromium port

- Moved voice-memo removal into **Settings → Privacy & Trust** and enabled it by default.
- Enabled **Omit teleport tag** by default, including for existing installations on the previous schema.
- Fixed geohash-channel right-click menus being blocked or triggering Firefox extension slowdown warnings.
- Paused heavy page enhancements while a native context menu is open.
- Limited message actions to actual message context menus.
- Throttled the Bitchat-to-Chat text rewrite and narrowed its attribute scan.
- Added a Chromium Manifest V3 build target with a service-worker background.
- Added Chrome 148+ namespace and runtime-message compatibility.
- Added `chrome-extension:` support for bundled font URLs.
- Packaged a `better-agnostr-1.1.2-chromium.zip` pre-release.
- Kept the Firefox build on `main`.

## 1.1.1 — Teleport omission, client control, matcha theme

- Fixed teleport-tag omission by removing `t=teleport` case-insensitively and re-checking the final signed frame before it reaches a relay.
- Removed the redundant native **Broadcast Agnostr client** switch; outgoing client tags are controlled by the Better Agnostr Client tab.
- Added the **Iced Matcha Latte** theme.
- Added the **Literata** serif font for long-form reading.

## 1.1.0 — Suite shortcut, group switcher, and serif fonts

- Removed the dedicated Settings and Better Agnostr buttons from the profile footer.
- Moved the Better Agnostr shortcut into the Agnostr Suite footer on every page.
- Rebalanced the suite footer so **Better Agnostr** and **Settings** share the row evenly.
- Added a simplified group switcher on the groups page with joined groups, a create/join button, and the Agnostr Suite button inline with the group buttons.
- Removed the generic rainbow fallback while a flair-specific rainbow is active, preventing the default rainbow flash when toggling rainbow formatting.
- Moved the stars shooting star further left and extended its travel so it is more noticeable.
- Added six bundled serif fonts: Playfair Display, Cormorant Garamond, Libre Baskerville, Lora, Fraunces, and Instrument Serif.

## 1.0.3 — Native reactions

- Removed the Better Agnostr reaction picker enhancements. Agnostr now provides reactions directly in the client.
- Removed the extra **＋** reaction control from the native hover reaction popover.
- Removed the extra **＋** reaction control from the message right-click reaction row.
- Removed the extension-side reaction sending path.
- Kept the categorized emoji picker for the message composer.

## 1.0.2 — Group navigation & About links hotfix

- Added a visible **Public chat** button to group conversations. It returns to Agnostr’s public Bitchat/geohash chat.
- Made the Agnostr Suite **Chat** card leave a group and return to public chat instead of doing nothing.
- Kept the Better Agnostr Suite control available in group conversations.
- Fixed **Settings → About** links so they open on the first click.
- Fixed the About **Angel** profile link so one click opens the native peer profile.
- Stopped the About pane from being rebuilt while open, which swallowed clicks.
- Added `noopener noreferrer` to external About links.

## 1.0.1 — Hotfix

- Added a dedicated visible Settings button directly next to the profile chip. It opens Agnostr’s native Settings menu.
- Kept the Better Agnostr sparkle shortcut alongside the new Settings button.
- Agnostr’s own footer actions are marked mobile-only now, so they stay hidden on desktop.
- Restored the Agnostr Suite Settings utility as a secondary fallback, while keeping the duplicate Better, Map, and Search suite utilities removed.
- Added a prominent unsigned-build warning to the README.
- Added this changelog and version-specific release notes.
- Added an explicit AI usage warning to the README.

## 1.0.0 — Initial public release

- Per-message signed-event JSON viewer with tags, verification, relay data, and Glub preview.
- Glub-compatible line/flair studio, themes, right-to-left rainbow, contained flair effects, and sparse obfuscation bursts.
- Client-tag spoofing with BetterAgnostr as the default client.
- Privacy controls: tag scrubbing, tracking-parameter stripping, review-before-signing, call blocking/removal, Locate Me hiding, and teleport omission.
- Retro message chimes and UI click sounds with per-event toggles.
- Hug, Slap, and custom actions using the `* action *` format.
- Composer, hover-reaction, and right-click emoji pickers with 2,300+ categorized base emoji.
- Native-styled event viewer and custom action dialogs.
- All Better Agnostr settings integrated into Agnostr’s native Settings UI.
- Firefox add-on assets, build workflow, MIT license, and GitHub release automation.
