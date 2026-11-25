# Better Agnostr 1.2.0 — Sonar rings, rainbow selection, client plaques, Alerts

**This release rebuilds the sonar rings, removes the rainbow flash when selecting a message, fixes false client plaques, integrates the new Alerts shortcut, and adds a hide-notification-button option.**

## Fixed

- Sonar wavefronts are now SVG circles animated by radius instead of scaled CSS borders. The thin cross is gone, and the CRT scanline glass is still there.
- Rainbow text no longer flashes back to plain text when a message is selected or deselected. The affected row is repaired synchronously before the next paint, and line rainbows keep their gradient in the gap.
- Rainbow text still uses glub.chat's 90° palette and motion in Glub mode; Bright remains the high-contrast 270° style.
- Client plaques now follow the client on the current event. A user who once used Better Agnostr but now sends from another client no longer gets a BA plaque with that client's name in it.
- The new Alerts shortcut opens a direct Notifications sheet. Better Agnostr's chime and click controls now appear inline in that sheet, not only in Settings → Notifications.
- Added **Appearance → Hide notification button**, which removes the Alerts shortcut from the desktop rail and mobile tab bar.

## Other

- README compressed and both warnings rewritten.
- Aurora left unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.2.0.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.2.0.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.2.0-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
