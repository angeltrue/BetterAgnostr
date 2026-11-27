# Better Agnostr 1.3.0 — signer removal and robustness pass

**Better Agnostr no longer implements a signer. This release removes the internal signer path and ships the robustness fixes from the local audit.**

## Signer scope

- Removed React-fiber signer discovery, identity-manager patching, local-key lookup, and the local re-sign fallback.
- The only pre-sign rewrite path is the page's standard NIP-07 provider (`window.nostr`). When no provider exists, Better Agnostr leaves signed events alone instead of re-signing them.
- Client tags, templates, tracking removal, tag stripping, and review-before-sign therefore require NIP-07. Native Agnostr signer support can replace this adapter without restoring the removed code.
- Teleport omission still fails closed: a signed event still carrying a teleport tag is blocked rather than silently sent.

## Fixed and hardened

- Page bridge: cross-window/forged envelopes are rejected, the session token is required on every message, and the diagnostic object/token exposure on `window` is gone.
- Rich text: fixed double escaping (`&` no longer becomes `&amp;amp;`), protected URL query strings from `&` colour-code parsing, and capped incoming rich text.
- Performance: fixed the 10 Hz empty obfuscation scan, stopped the rich observer/obfuscation fight, cleaned up detached rich observers, and made reduced-motion obfuscated text readable.
- Flairs: enforced the documented limits and aliases, stopped repeated random style regeneration, and preserved newer message content over stale rich snapshots.
- Settings: malformed sections no longer crash normalization, multi-tab changes apply without a reload, backup restore is guarded, and the origin backup only advances after a successful save.
- Sounds: native sound suppression is ref-counted across tabs and restores only the `soundEnabled` boolean instead of overwriting unrelated notification settings.
- Review modal: closed dialogs are `hidden`/`inert`, focus is trapped and restored, stale custom-action targets are cleared, tags are removed by index, and the review timer matches the page timeout.
- Calls: blocking covers all call-signal kinds, blocked signals are not retained in the event store, and the hide-UI toggle is honoured.
- Composer: voice-memo hiding covers encrypted DMs, actions target the active composer dock, the toolbar rebuilds correctly, and the emoji picker is more keyboard/viewport safe.
- Chat labels: the targeted adapter now covers the Bitchat drawer, quickbar, and globe, with title updates and trailing retries for plaques/call controls.
- Release: added tests, version assertions, and source builds in CI for both Firefox and Chromium.

## Notes

- Aurora is unchanged.
- Outgoing rewriting is unavailable with a native Agnostr signer until a NIP-07 provider or upstream signing hook is present.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.0.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.0.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.0-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
