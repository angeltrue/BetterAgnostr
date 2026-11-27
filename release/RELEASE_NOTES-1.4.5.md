# Better Agnostr 1.4.5 — voice memo button hotfix

**The “Remove voice memo” setting now actually removes the composer button, including after React re-renders it.**

## Fixed

- The setting now toggles a `ba-hide-voice-memo` class on the document root. CSS hides the composer’s launcher directly, so it cannot reappear when React replaces the button.
- Hiding is scoped to `.ag-composer-right > button`, so the recorder’s own send, cancel and discard controls keep working.
- The previous inline hide/restore path remains for immediate removal and for switching the setting back off.

## Preserved

- One flair surface per same-flair run with dynamic extension and retraction.
- Independent fire ash motion and full-width aurora star fields.
- The 1.4.2 flair reliability fixes.
- The restored signer, local-key fallback and NIP-07 re-signing.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.4.5.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.4.5.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.4.5-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
