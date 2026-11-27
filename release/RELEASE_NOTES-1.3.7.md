# Better Agnostr 1.3.7 — flair overlap and visibility fixes

**Fixes the remaining flair run discontinuities, overlap, neon fading, star density, fire ash, and People-list badge flicker.**

## Flairs

- Rain continues through the next same-flair message instead of resetting at each row boundary.
- Aurora FX is constrained to its row or same-flair run instead of overlapping neighbouring messages.
- Neon frames no longer fade and share one tube color across joined rows.
- Star bands scale down on short messages and back up on tall ones.
- Fire ash particles are larger, brighter, and visible for longer.

## UI

- People-list BA badges are repaired synchronously by a targeted observer, so they no longer flicker in and out.
- Better Agnostr settings controls continue to inject synchronously with the native settings dialog.
- Chat rail/tab labels keep the static fallback that prevents a Bitchat flash.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.7.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.7.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.7-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
