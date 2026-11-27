# Better Agnostr 1.4.0 — performance release

**Cuts the constant DOM, bridge, and verification work that made busy chats heavy.**

## Performance changes

- **Notification-only hot-path verification.** Chat, mention, DM, and call events are still signature-verified before they can trigger a chime or banner. Other relay events are stored without a synchronous Schnorr verification and are verified on demand in the event viewer.
- **Compact relay bridge.** Full event objects cross the bridge only for alert events. A small peer summary keeps BA plaques working, and the viewer fetches the full event when opened.
- **One parse per relay frame.** Frames are cached per message event, and non-EVENT/OK frames skip the call-blocking/translation parser.
- **Scoped observers.** The page observer watches child-list changes document-wide and class changes only inside the message-row container. Chat labels are observed only on the rail, header, drawer, settings, sheet, popover, and toast roots.
- **Dirty-row decoration.** Rows are re-checked when they change, not on every enhance pass. A slow safety sweep still catches anything the mutation observer misses.
- **Flair work only when needed.** Join geometry runs when flair rows change, resize, or when settings change. Style variables are written only when different. Star-band density is cached by height, and flaired rows use resize/visibility observers instead of a global measurement tick.
- **Quieter background work.** Status messages are diffed and paused on hidden tabs. Call-menu policy runs only when a menu is added. Call/locate control scans are scoped to real controls. The obfuscation timer is 4 Hz instead of 10 Hz, and the flair ticker is 1.8 s instead of 1.5 s.

## Preserved

- The restored signer, local-key fallback, and NIP-07 last-mile re-signing.
- The bounded rain clip from 1.3.8 and the 1.3.7 flair behavior.
- Rainbow modes, sonar rings, Glub palette/motion, real BA plaques, readable serif fonts, Chat labels, Alerts controls, notification-button hiding, and the fixed action menu.

## Notes

- Firefox and Chromium builds remain in one release entry.
- This release changes only performance paths; no settings migration is required.

## Downloads

- `better-agnostr-1.4.0.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.0.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.0-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
