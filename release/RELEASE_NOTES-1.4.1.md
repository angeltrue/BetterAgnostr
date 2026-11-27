# Better Agnostr 1.4.1 — dynamic flair runs

**One flair per run now extends and retracts with the messages instead of stacking a new flair on every row.**

## What changed

- **One surface per run.** A contiguous run of the same flair is now rendered by the first message. Following messages become members of that run and do not create their own background layer or FX layer.
- **Dynamic height.** The host layer measures the run and extends to the bottom of the last member, then retracts when messages leave the run. Gaps between messages are covered by the same surface.
- **No doubled flair.** The old implementation attached flair classes to both the row and an inner layer, so pseudo-element backgrounds rendered twice. Row-level pseudo backgrounds are now suppressed; only the host layer paints the flair.
- **No internal seams.** The per-row join fades, shared-border fixes and copied rain/neon/aurora variables are no longer needed for same-flair runs. The surface fades only at the outer ends of the run.
- **Fixed particle sizes.** Stars, shooting stars, ash, fireflies, rain, plume and aurora keep their existing pixel sizes. Fire embers and bubbles gain distributed vertical spawn positions across a longer run without becoming larger.
- **Taller bitcoin boards.** The circuit board adds trace lanes for taller runs while the coin stays sized to the first message.
- **Run-aware limits.** Flair limits count runs instead of individual messages, so a long same-flair run is not cut off after the limit.

## Preserved

- The restored signer, local-key fallback and NIP-07 re-signing.
- All 14 flairs, rainbow modes, text animations and reduced-motion behavior.
- The 1.4.0 verification, observer, bridge and scheduling optimizations.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.4.1.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.1.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.1-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
