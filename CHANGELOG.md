# Changelog

All notable changes to Better Agnostr are documented here.

## 1.0.3 — Native reactions

- Removed the Better Agnostr reaction picker enhancements. Agnostr now provides reactions directly in the client.
- Removed the extra **＋** reaction control from the native hover reaction popover.
- Removed the extra **＋** reaction control from the message right-click reaction row.
- Removed the extension-side reaction sending path.
- Kept the categorized emoji picker for the message composer.

## 1.0.2 — Group navigation & About links hotfix

- Added a visible **Public chat** button to group conversations. It returns to Agnostr’s public Bitchat/geohash chat.
- Made the Agnostr Suite **Chat** card leave a group and return to public chat instead of doing nothing.
- Kept the Better Agnostr Suite control available in group conversations.
- Fixed **Settings → About** links so they open on the first click.
- Fixed the About **Angel** profile link so one click opens the native peer profile.
- Stopped the About pane from being rebuilt while open, which swallowed clicks.
- Added `noopener noreferrer` to external About links.

## 1.0.1 — Hotfix

- Added a dedicated visible Settings button directly next to the profile chip. It opens Agnostr’s native Settings menu.
- Kept the Better Agnostr sparkle shortcut alongside the new Settings button.
- Agnostr’s own footer actions are marked mobile-only now, so they stay hidden on desktop.
- Restored the Agnostr Suite Settings utility as a secondary fallback, while keeping the duplicate Better, Map, and Search suite utilities removed.
- Added a prominent unsigned-build warning to the README.
- Added this changelog and version-specific release notes.
- Added an explicit AI usage warning to the README.

## 1.0.0 — Initial public release

- Per-message signed-event JSON viewer with tags, verification, relay data, and Glub preview.
- Glub-compatible line/flair studio, themes, right-to-left rainbow, contained flair effects, and sparse obfuscation bursts.
- Client-tag spoofing with BetterAgnostr as the default client.
- Privacy controls: tag scrubbing, tracking-parameter stripping, review-before-signing, call blocking/removal, Locate Me hiding, and teleport omission.
- Retro message chimes and UI click sounds with per-event toggles.
- Hug, Slap, and custom actions using the `* action *` format.
- Composer, hover-reaction, and right-click emoji pickers with 2,300+ categorized base emoji.
- Native-styled event viewer and custom action dialogs.
- All Better Agnostr settings integrated into Agnostr’s native Settings UI.
- Firefox add-on assets, build workflow, MIT license, and GitHub release automation.
