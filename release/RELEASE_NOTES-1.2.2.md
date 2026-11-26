# Better Agnostr 1.2.2 — action menu and performance

**This hotfix restores the fixed top-right message action menu and cuts unnecessary row-decoration work.**

## Fixed

- Agnostr moved the message action toolbar into the row's flex flow, so it followed the message text. Better Agnostr restores the previous fixed top-right position, with the existing mobile offset preserved.
- Rainbow and flair rows are no longer fully re-decorated on every enhance pass. BA now checks the row's class/data signature first and repairs only the row that actually lost something.
- Hover and action-menu class changes no longer trigger a full page enhance when the row is already intact.
- Rich-text and flair repair remains immediate, so the rainbow selection fix is preserved.
- Reduced the Bitchat-to-Chat text scan to UI regions instead of walking the entire conversation pane.

## Notes

- Aurora is unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.2.2.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.2.2.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.2.2-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
