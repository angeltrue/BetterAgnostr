# Better Agnostr 1.4.3 — flair detail hotfix

**Small visual fixes for fire ash and aurora stars.**

## Changed

- **Fire ash:** now uses 10 particles per run instead of 8, with wider randomized spacing, more vertical scatter, and a wider drift path. The ash shower fills more of the row without making individual particles larger.
- **Aurora stars:** now use three full-layer repeating star fields instead of narrow box-shadow bands. The stars span the full run width, including the right edge, and the full run height.
- Removed the old aurora star band styling and keyframes.

## Preserved

- One flair surface per same-flair run with dynamic extension and retraction.
- The 1.4.2 flair reliability fixes: multi-root row observers, in-place repair, visible-only limits, and the tab-switch refresh.
- The restored signer, local-key fallback and NIP-07 re-signing.
- All 14 flairs, rainbow modes and reduced-motion behavior.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.4.3.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.3.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.3-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
