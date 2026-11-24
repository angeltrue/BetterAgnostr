# Better Agnostr 1.0.3 — Native reactions

**Agnostr now implements reactions directly, so Better Agnostr no longer adds its own reaction picker layer.**

## Changed

- Removed the extra **＋** reaction control from the native hover reaction popover.
- Removed the extra **＋** reaction control from the message right-click reaction row.
- Removed the extension-side reaction sending path.
- Kept the categorized emoji picker for the message composer.

Reactions now use Agnostr’s own native picker and event pipeline without interference from Better Agnostr.

## Downloads

- `better-agnostr-1.0.3.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.0.3.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
