# Better Agnostr 1.1.2 — Privacy defaults and context-menu stability

**Voice-memo removal and teleport-tag omission are now on by default, and native channel right-click menus no longer stall or trigger extension slowdown warnings.**

## Changed

- Moved **Remove voice memo** into **Settings → Privacy & Trust**.
- **Remove voice memo** is enabled by default.
- **Omit teleport tag** is enabled by default, including for existing installations on the previous settings schema.

## Fixed

- Geohash-channel right-click menus now open normally.
- Heavy page enhancements pause while a native context menu is open.
- Message actions are only added to real message context menus.
- The Bitchat-to-Chat text rewrite is throttled and no longer scans every attribute on every page change.

## Downloads

- `better-agnostr-1.1.2.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.2.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
