# Better Agnostr 1.1.5 — Call cleanup, mobile polish, and group switcher

**This hotfix removes the remaining call controls, fixes the groups-page switcher for Agnostr's current layout, simplifies group navigation, and cleans up the mobile interface.**

## Fixed

- Room Info call sections are removed entirely while call blocking is enabled.
- Call action buttons, sheet actions, and reaction/context-menu call items are hidden immediately with CSS.
- A capture click blocker prevents late-rendered call controls from being clicked.
- The redundant **Public chat** button is gone. The Agnostr Suite's **Chat** card still returns to public chat.
- The groups-page switcher now supports both the current group pane markup and the group-channel layout.
- The switcher refreshes after joined groups change.

## Mobile

- Hidden redundant Agnostr Suite triggers; the **Apps** tab remains the suite entry.
- Removed the floating Better Agnostr button that overlapped the composer.
- Renamed the **Bitchat** tab label to **Chat**.
- Room Info call controls stay hidden.

## Downloads

- `better-agnostr-1.1.5.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.5.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
