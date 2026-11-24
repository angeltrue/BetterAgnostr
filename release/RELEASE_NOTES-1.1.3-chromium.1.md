# Better Agnostr Chromium 1.1.3 — pre-release

**Chromium port at feature parity with Firefox 1.1.3: BA username plaques, corrected self-profile teleport visuals, and hover-menu cleanup.**

## Changed

- Removed the extension's green Better Agnostr avatar border.
- Agnostr's own client-indicator borders remain the only avatar borders.
- Added a compact **BA** plaque next to Better Agnostr usernames in messages, the People list, the quick profile, and the peer profile.
- Hid the visual **TELEPORT** badge on your own profile when **Omit teleport tag** is enabled.
- Cleared stale message hover state after the event viewer, Hug, Slap, and custom actions.
- Added pointer-move cleanup so a hover action bar cannot remain stuck after the pointer leaves.

## Install

1. Download and unzip `better-agnostr-1.1.3-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
