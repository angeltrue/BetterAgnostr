# Better Agnostr 1.4.2 — flair reliability hotfix

**Fixes flair and rainbow styling being skipped or restarting when switching Agnostr tabs, clicking messages, or recycling the message list.**

## Fixed

- **Skipped rows after tab switches.** Mutation batches now process every added row instead of breaking after the first relevant node.
- **Multiple message panes.** Row observers now attach to every message-list root and to new roots as they mount, rather than only the first list.
- **Recycled rows.** Row `id` changes are observed, so a row reused for a different message is repaired immediately.
- **Faster recovery.** Agnostr's rail, mobile tabs, suite cards, server rail and conversation rows trigger an immediate flair/line refresh. A 3-second safety sweep catches anything that still slips through.
- **No animation reset on click.** Flairs and `&g` line classes are repaired in place. React stripping row or author classes no longer destroys the layer/FX DOM, so matrix columns and other animations keep running.
- **Visible-only limits.** Matrix, plume, aurora and bitcoin limits now count only run surfaces visible in the viewport. Hidden tabs no longer consume slots and block flairs in the active tab.
- **Aurora stars.** Star fields are now distributed across the whole run instead of one top-anchored field.
- **Bitcoin coins.** Coins are distributed down the run at fixed size, up to four, instead of showing only on the first message.

## Preserved

- One flair surface per same-flair run, with dynamic extension and retraction.
- The restored signer, local-key fallback and NIP-07 re-signing.
- All 14 flairs, rainbow modes, text animations and reduced-motion behavior.
- The 1.4.0 verification, observer, bridge and scheduling optimizations.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.4.2.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.2.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.2-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
