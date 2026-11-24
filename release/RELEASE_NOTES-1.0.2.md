# Better Agnostr 1.0.2 — Group navigation & About links hotfix

**Group conversations now have a visible route back to public chat, and the About links open on the first click.**

## Fixed

- Added a **Public chat** button to group conversations. It restores Agnostr’s public Bitchat/geohash chat.
- Made the Agnostr Suite **Chat** card leave a group and return to public chat instead of doing nothing.
- Kept the Better Agnostr Suite control available inside group conversations.
- Fixed **Settings → About** links so a single click opens the GitHub pages in a new tab.
- Fixed the About **Angel** link so a single click opens the native peer profile.
- Stopped the About pane from being rebuilt while it is open, which was swallowing clicks.
- Added `noopener noreferrer` to external About links.

## Downloads

- `better-agnostr-1.0.2.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.0.2.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
