# Better Agnostr 1.4.4 — fire ash motion hotfix

**Fire ash particles now animate independently instead of rising in sync.**

## Fixed

- Fire ash used one box-shadow field, which meant one animation and one clock for every clone. Ash is now 10–12 individual spans.
- Each ash speck has its own duration, negative phase delay, lift height, vertical spawn position and drift path.
- Ash particles keep their 2–3 px size and stay distributed across multi-message fire runs.

## Preserved

- The 1.4.3 aurora full-width star fields and increased fire ash density.
- One flair surface per same-flair run with dynamic extension and retraction.
- The 1.4.2 flair reliability fixes.
- The restored signer, local-key fallback and NIP-07 re-signing.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.4.4.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.4.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.4-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
