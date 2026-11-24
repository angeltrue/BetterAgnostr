# Changelog

All notable changes to Better Agnostr are documented here.

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
