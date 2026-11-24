# Better Agnostr 1.1.4 — Performance and suite menu flash

**This hotfix cuts Better Agnostr's idle DOM work, lowers long-session memory use, and stops the Agnostr Suite from flashing its old Map/Search utilities and Bitchat label.**

## Performance

- Filtered the page MutationObserver to relevant UI changes instead of every class change.
- Disconnected the observer during Better Agnostr's own DOM updates to stop feedback loops.
- Cached per-row decoration so unchanged message rows are skipped.
- Throttled call-control, Better Agnostr plaque, and Bitchat-label maintenance.
- Cached obfuscated-text targets instead of scanning the document every 70 ms.
- Deferred enhancement work while the tab is hidden.
- Reduced event and relay-log history caps to keep long sessions lighter.

## Suite menu

- Map and Search utilities are hidden with CSS before the suite appears.
- The Chat card renders as **Chat** immediately, without flashing “Bitchat”.
- The footer keeps a stable two-column layout while the Better Agnostr shortcut is added.

## Downloads

- `better-agnostr-1.1.4.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.4.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
