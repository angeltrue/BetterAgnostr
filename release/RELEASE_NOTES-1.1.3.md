# Better Agnostr 1.1.3 — Client plaques, teleport visuals, and hover cleanup

**Better Agnostr now uses a small BA plaque instead of a green avatar border, hides the misleading self-profile teleport badge, and fixes stuck message hover menus.**

## Changed

- Removed the extension's green Better Agnostr avatar border.
- Agnostr's own client-indicator borders remain the only avatar borders.
- Added a compact **BA** plaque next to Better Agnostr usernames in messages, the People list, the quick profile, and the peer profile.
- Hid the visual **TELEPORT** badge on your own profile when **Omit teleport tag** is enabled.
- Cleared stale message hover state after the event viewer, Hug, Slap, and custom actions.
- Added pointer-move cleanup so a hover action bar cannot remain stuck after the pointer leaves.

## Downloads

- `better-agnostr-1.1.3.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.3.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
