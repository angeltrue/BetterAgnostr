# Changelog

All notable changes to Better Agnostr are documented here.

## 1.4.4 — fire ash motion hotfix

- Fire ash is now rendered as 10–12 independent spans instead of one box-shadow field. Every ash speck gets its own duration, phase delay, lift height and drift path, so the particles no longer rise in lockstep.
- Ash particles keep their 2–3 px size and remain distributed across multi-message fire runs.
- Kept the 1.4.3 aurora star fields and fire ash density.
- Kept Firefox and Chromium downloads in one release entry.

## 1.4.3 — flair detail hotfix

- Fire ash now uses 10 particles per run instead of 8, with wider randomized spacing, more vertical scatter, and a wider drift path.
- Aurora stars now use three full-layer repeating star fields instead of narrow box-shadow bands. Stars reach the right edge and cover the full run height.
- Removed the old aurora star band styling and keyframes.
- Kept the 1.4.2 flair reliability fixes and the 1.4.1 one-surface-per-run architecture.
- Kept Firefox and Chromium downloads in one release entry.

## 1.4.2 — flair reliability hotfix

- Fixed flairs and `&g` rainbow styling being skipped after switching tabs in Agnostr. Mutation batches now process every added row instead of stopping after the first relevant node.
- Row observers now attach to every message-list root, including new panes as they mount, instead of only the first list. Reused rows that change their `id` are also repaired immediately.
- Added a navigation-click hook for Agnostr's rail, mobile tabs, suite cards, server rail and conversation rows, plus a 3-second safety sweep, so recycled lists reapply flair and line styling without waiting for a later mutation.
- Flairs and line styles are repaired in place. React stripping row, author or message classes no longer tears down the flair layer and FX layer, so clicking a message does not restart matrix columns or other animations.
- Flair limits now count only hosts whose run surface is visible in the viewport. Hidden tabs no longer hold matrix, plume, aurora or bitcoin slots and block flairs in the active tab.
- Aurora stars are now distributed overlay bands across the whole run instead of one top-anchored star field.
- Bitcoin coins are distributed down the run at fixed size, up to four, instead of appearing only on the first message.
- Kept the 1.4.1 one-surface-per-run architecture and the 1.4.0 performance work.
- Kept Firefox and Chromium downloads in one release entry.

## 1.4.1 — dynamic flair runs

- Rebuilt flair rendering around one surface per contiguous same-flair run. The first message hosts a single background layer and FX layer; following messages become run members instead of each rendering their own flair.
- The host layer now extends and retracts to the run's measured height, including the gaps between messages. Same-flair messages no longer meet at per-row masks, doubled pseudo-elements, or internal seams.
- Suppressed the row-level pseudo backgrounds that duplicated the old layer. Row classes remain for text colours and text animations, so the visible surface is rendered once.
- Run membership is recomputed when messages are added, removed, split, merged, or resized. A run promoted to a new host builds its surface immediately; a removed host hands the surface to the next message.
- Particle sizes stay fixed. Fire embers and bubbles gain random vertical positions across a multi-message run without growing; stars, shooting stars, ash, fireflies, rain, plume and aurora keep their existing pixel sizes.
- The bitcoin board now adds trace lanes for taller runs, while its coin stays sized to the first message. Neon draws one frame around the whole run.
- Flair limits now count runs rather than messages, so a long same-flair run is not cut off after the limit.
- Kept the 1.4.0 verification, observer, bridge, and scheduling optimizations.
- Kept Firefox and Chromium downloads in one release entry.

## 1.4.0 — performance release

- Incoming relay events are now signature-verified only when they can trigger a notification (chat, mentions, DMs, calls). Everything else is verified on demand in the event viewer, removing Schnorr verification from the bulk relay hot path.
- Relay bridge logs are compact: full event objects are sent only for alert events, outgoing events keep their IDs, and a small peer summary preserves BA plaques without cloning full tags/content. The viewer fetches a full event when it opens one.
- Relay frames are parsed once per `MessageEvent` and cached. Non-EVENT/OK frames skip the call-blocking/OK-translation parser entirely.
- The page observer now watches child-list changes document-wide and class changes only on the message-row container, instead of every class mutation in the whole app.
- Chat-label observation is attached only to the rail, header, drawer, settings, sheet, popover and toast roots. Body-wide text and attribute observation is gone.
- Message decoration uses a dirty-row set instead of re-checking every row on every enhance pass, with a slow safety sweep.
- Flair joins recompute only when flair rows are added/removed/resized or settings change. CSS variables and join attributes are written only when their values differ.
- Star-band density is cached by row height, and flaired rows use `ResizeObserver`/`IntersectionObserver` instead of global measurement on every tick.
- Status messages are diffed and paused while the tab is hidden. Call-menu policy runs only when a context menu is added, and call/locate scans are scoped to actual controls.
- Obfuscation timer reduced from 10 Hz to 4 Hz; flair ticker reduced from 1.5 s to 1.8 s. Flair, rain, signer and all 1.3.x behavior remain intact.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.10 — performance hotfix

- Removed the full-document Bitchat text sweep from every enhance pass. Chat labels are now handled by the targeted mutation adapter and a one-time startup pass.
- Scoped Chat-label mutations to the rail, tabs, headers, drawers, settings, sheets, popovers and toasts instead of scanning message and composer text.
- Merged the separate settings and People badge observers into the existing page observer, removing two whole-document MutationObservers.
- People badge observation is child-list only and keeps its re-entrancy guard, eliminating the continuous character-data workload.
- Throttled flair-join and star-density measurements so large flaired conversations no longer force layout work on every enhance.
- Slowed the People/peer badge scan from 500 ms to 1.5 s; targeted repairs still run immediately.
- Kept the bounded rain clip and existing flair behavior.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.9 — People badge loop hotfix

- Fixed the People-list badge observer feedback loop: the inserted BA badge text was being read as part of the display handle, which made the observer remove and re-add the badge indefinitely and trigger Firefox's “slowing down Firefox” warning.
- Badge/name lookups now strip the badge text before matching handles and client labels.
- Kept the 1.3.8 bounded rain clip and the 1.3.7 flair behavior unchanged.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.8 — crash hotfix

- Replaced the rain FX clip with a bounded per-row clip instead of a 200vh paint area. The oversized clip could create extremely large compositor surfaces on busy chats and crash the browser.
- Added a re-entrancy guard and self-mutation filtering to the People-list badge observer so it cannot repeatedly trigger itself.
- Kept the 1.3.7 flair behavior unchanged while removing the crash paths.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.7 — flair overlap and visibility fixes

- Rain in a same-flair run now continues through the next message instead of resetting at each boundary.
- Aurora FX is constrained to its row/run bleed instead of extending across neighbouring messages.
- Neon frames no longer fade at the ends and keep one shared tube color across joined rows.
- Star band density scales down on short messages and up on tall ones.
- Fire ash particles are larger, brighter, and remain visible longer before fading.
- People-list BA badges are repaired synchronously by a targeted observer, so they stop flickering in and out.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.6 — flair polish, concrete badges, instant settings

- Rain now continues through the next message in a same-flair run, so drops no longer stop at every row boundary.
- Star band density now adapts to message height: small messages get fewer animated bands, tall messages get the full set.
- Neon rows in the same run now share one tube color and remove the shared border/glow edge, fixing the color mismatch and cut line.
- Aurora rows in the same run no longer fade at their shared boundary, removing the visible cut line while keeping the outer fade.
- Replaced the pseudo-element BA plaque with a real `.ba-client-badge` element with an accessible label.
- Settings injection now reacts to the native settings modal before paint instead of waiting for the debounced sync, so Better Agnostr controls do not visibly pop in.
- Added a static Chat-label fallback for the rail/tab labels to prevent Bitchat flicker before the adapter runs.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.5 — rain loops and animated star bands

- Reworked rain so drops stay invisible above the message, enter at the top edge, fall through the full row, and fade out at the bottom instead of popping into view or being clipped mid-cycle.
- Clipped rain horizontally and above the row while still allowing drops and splashes to continue below it, removing phantom droplets outside the message.
- Replaced the stars flair’s two animated bands with six independently timed star bands plus the full-height repeating field.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.4 — joined flairs, instant Chat labels, theme consistency

- Rows with the same flair now join into one continuous run: no fade or un-flaired seam between them, with the fade reserved for the outer ends of the run.
- Joined flairs extend into the gap between messages, including grouped messages, and square off their shared corners; different flairs still fade separately.
- Moved animated flairs’ FX layer outside the clipped background layer, so puffs, curtains, embers, rain, bolts, and shooting stars can extend past the row instead of being cut off mid-animation.
- Bitchat labels are now replaced synchronously from the DOM mutation observer, before paint, instead of waiting for the debounced text sweep.
- Fixed the custom-property cycle that made event-viewer and custom-action text fall back to the dark default on light themes.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.3 — animated flair edges

- Widened the flair edge fade so animated particles, curtains, embers, rain, and shooting stars taper out instead of being clipped mid-animation at the row edge.
- Kept the stars card’s dark edge crisp while softening the animated effects around it.
- Corrected shooting-star positioning for the flair layer.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.2 — scalable flairs and seamless rows

- Rebuilt the stars flair as a repeating starfield that fills any row height, including image and long-message rows, instead of stopping after two bands.
- Added an ink-black base and light text inside the stars flair so it remains readable on Agnostr’s light/default theme.
- Softened the top and bottom edges of every message flair layer so consecutive flaired messages no longer show a hard cutoff line where one row ends and the next begins.
- Kept the stars/shooting-star animation and the existing flair budget behavior.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.1 — signer restoration and notification/UI fixes

- Restored Agnostr signer integration and the local-key fallback, with bounded discovery, exponential backoff, cached instances, and fail-closed handling when no signer can be reached. Teleport-tag messages can be stripped and re-signed again instead of being blocked.
- Added NIP-07 re-signing as a second last-mile fallback when a provider matches the event pubkey.
- Stopped call-blocked notices from repeating on every signal; repeated BA notices now share a cooldown.
- Restyled Better Agnostr toasts to match Agnostr's native toast layout and icon treatment.
- Removed Agnostr's transient “Image Safety Classifier ready / Running locally via WASM” toast.
- Fixed the event viewer’s scroll container so JSON, tags, and previews scroll inside the dialog.
- Broadened the Bitchat → Chat label adapter across new rail, drawer, room-switcher, call, and toast surfaces, with a char-data/attribute observer.
- Prevented readable serif fonts from clipping descenders in the left rail (Agora, Agwallet) and mobile labels.
- Kept Firefox and Chromium downloads in one release entry.

## 1.3.0 — signer removal and robustness pass

- Removed Better Agnostr's internal signer implementation: no React-fiber discovery, identity-manager patching, local-key lookup, or re-signing. A NIP-07 provider is the only pre-sign rewrite path.
- Outgoing client tags, templates, tracking removal, tag stripping, and review-before-sign now run only when that NIP-07 provider is present; native-signer events are left untouched instead of being re-signed locally.
- Made the page bridge reject cross-window/forged envelopes, require the session token on every message, and stopped exposing the token or diagnostics through `window.__betterAgnostr`.
- Fixed rich-text double escaping, stopped `&` colour codes from eating URL query strings, and capped incoming rich text.
- Fixed the 10 Hz empty obfuscation scan and the rich-text observer fight; reduced rich observers on removed rows and made reduced-motion obfuscated text readable.
- Enforced flair limits and aliases, repaired flair/line style loss without re-randomizing every pass, and kept rich snapshots from overwriting newer content.
- Hardened settings normalization against malformed storage, made multi-tab settings changes apply without reload, and only advance the origin backup after a successful save.
- Made native sound suppression ref-counted across tabs and restore only the `soundEnabled` boolean instead of the whole notification object.
- Fixed review-modal focus escaping and stale custom actions; closed modals now use `hidden`/`inert`, trap focus, restore focus, and clear stale targets. Review tags are removed by index and the timer now matches the page timeout.
- Expanded call blocking to all call-signal kinds, kept blocked signals out of the event store, and honoured the hide-UI toggle.
- Fixed voice-memo hiding in encrypted DMs, scoped composer actions to the active dock, repaired toolbar rebuilding, and improved emoji-picker accessibility.
- Expanded the Chat label adapter to the Bitchat drawer/quickbar/globe, added target retries for plaques and call controls, and fixed the Chat document title.
- Added a real test suite for parser escaping, URL handling, templates, tracking removal, settings normalization, and flair limits; CI now builds both browsers from source and verifies versions.
- Kept Firefox and Chromium downloads in one release entry.

## 1.2.2 — action menu and performance

- Restored the message action toolbar to its previous fixed top-right position; Agnostr's new flex-flow placement no longer applies.
- Added a row-decoration signature fast path so intact rows are not re-decorated on every enhance pass.
- Targeted repairs now run only for rows missing a BA class, rich-text state, flair layer, or JSON button.
- Row hover/action class changes no longer schedule a full page enhance when the row is intact.
- Preserved immediate rainbow/rich-text repair on selection.
- Removed the whole-conversation pane from the Bitchat-to-Chat text scan.
- Kept Firefox and Chromium downloads in one release entry.

## 1.2.1 — Plaques, Chrome rainbow, fonts, warnings

- Plaques now show only **BA** or nothing; client names are no longer appended, and ordinary users of other clients no longer get a client-name plaque in chat.
- Hardened rainbow painting in Chromium with descendant fill enforcement and background-position layer promotion.
- Renamed every visible Bitchat label in the UI to **Chat**.
- Replaced Playfair Display, Cormorant Garamond, Lora, Literata, Fraunces, and Instrument Serif with Source Serif 4, IBM Plex Serif, Merriweather, Crimson Pro, Spectral, and Noto Serif.
- Kept Libre Baskerville.
- Migrated removed font choices to the default.
- Made README warnings much larger, louder, and deliberately obnoxious while keeping the rest compressed.
- Left aurora unchanged.
- Kept Firefox and Chromium downloads in one release entry.

## 1.2.0 — Sonar rings, rainbow selection, client plaques, Alerts

- Rebuilt sonar wavefronts as SVG circles animated by radius, removing the clipped-border cross while keeping the CRT scanlines.
- Repaired BA row formatting synchronously when React rewrites a selected row, eliminating the rainbow flash on select/deselect.
- Kept line-rainbow gradients visible from their data attribute during the repair gap.
- Fixed false BA plaques for users whose current event comes from another client.
- Integrated Better Agnostr sound settings into the new Alerts shortcut's Notifications sheet.
- Added **Appearance → Hide notification button** to remove the Alerts shortcut from the rail and mobile tab bar.
- Compressed README and rewrote both warnings.
- Left aurora unchanged.
- Kept Firefox and Chromium downloads in one release entry.

## 1.1.15 — Sonar rings, exact Glub rainbow, Appearance toggle

- Restored the sonar CRT scanline glass.
- Fixed the thin cross in sonar rings by replacing the ring box-shadow with a gradient glow and promoting each scaled ring to its own compositing layer.
- Reimplemented the Glub rainbow from glub.chat: 90° gradient, 200% scroll, 6-second timing, no screen blend, no white glow.
- Flair-specific rainbows use the same 90° axis in Glub mode, and rain's wildcard flows vertically.
- Bright keeps the previous 270° high-contrast rainbow.
- Moved the rainbow choice to **Appearance → Glub rainbow** and replaced the chip selector with an inline toggle switch.
- Kept the rainbow choice device-local.
- Left aurora unchanged.
- Kept Firefox and Chromium downloads in one release entry.

## 1.1.14 — Rainbow styles, aurora, sonar, selection fix

- Added a selectable **Rainbow style** under Better Agnostr → Line.
- **Glub** is the default and matches glub.chat: original palette, no screen blend, no white glow, right-to-left motion.
- **Bright** keeps the 1.1.11 reworked rainbow: brighter fill, screen blend, white glow, left-to-right motion.
- The rainbow style is device-local and is not written into outgoing events.
- Both message previews follow the selected rainbow style.
- Fixed rainbow colours resetting when selecting and deselecting a message by re-decorating rows after React rewrites their classes and by keeping flair rainbow fallbacks rainbow.
- Fixed the sonar cross artifact by replacing its scanline overlay with a soft radial scope glow.
- Reworked aurora into layered northern-lights curtains with stars, rays, folds, sway, and breathing.
- Kept Firefox and Chromium downloads in one release entry.

## 1.1.13 — Badge rendering, profile clients, timestamps

- Fixed BA and spoofed-client plaques rendering transparent or glowing under rainbow and colour line effects.
- Reset plaque text fill, shadow, animation, and clipping so the plaque always displays normally.
- Updated the peer profile client pill from the event client tag instead of Agnostr's cached client.
- Profile pill now shows spoofed clients and a BA-styled **BetterAgnostr** value.
- Added **Hide timestamps** under Privacy & Trust → Better Agnostr, disabled by default.
- Timestamp hiding removes per-message clock times without hiding date dividers.
- Kept Firefox and Chromium downloads in one release entry.

## 1.1.12 — Native sound effects off

- Disabled Agnostr's separate **Sound Effects** engine, which was still playing default incoming-message, mention, DM, send, and UI sounds.
- Hid the native **Audio → Sound Effects** section while Better Agnostr is active.
- Preserved the native sound-effects preference and restored it when Better Agnostr is paused.
- Kept native notifications, ringtone, vibration, and lock-screen previews intact.
- Better Agnostr chimes and UI clicks remain the active sound system.
- Kept Firefox and Chromium downloads in one release entry.

## 1.1.11 — Brighter rainbow and scattered shooting stars

- Brightened `&g` rainbow text with a screen-blended fill and a soft white glow.
- Reduced the heavy dark shadow that made rainbow text look dim.
- Kept emoji glyphs untouched by rainbow formatting.
- Shooting stars now fire across 1–3 different visible flaired rows per trigger.
- Each shooting star gets its own delay, start position, angle, length, duration, and path.
- Restricted shooting-star targets to rows visible in the viewport.
- Kept both Firefox and Chromium downloads in one release entry.

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

## 1.1.2 — Privacy defaults and context-menu stability

- Moved voice-memo removal into **Settings → Privacy & Trust** and enabled it by default.
- Enabled **Omit teleport tag** by default, including for existing installations on the previous schema.
- Fixed geohash-channel right-click menus being blocked or triggering Firefox extension slowdown warnings.
- Paused heavy page enhancements while a native context menu is open.
- Limited message actions to actual message context menus.
- Throttled the Bitchat-to-Chat text rewrite and narrowed its attribute scan.

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
