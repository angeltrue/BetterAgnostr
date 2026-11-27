# Better Agnostr 1.3.10 — performance hotfix

**Cuts the continuous DOM/text work that was slowing Firefox and Chromium.**

## Optimizations

- Removed the full-document Bitchat text sweep from every enhance pass. Chat labels now use the targeted mutation adapter plus a one-time startup pass.
- Scoped Chat-label observation to UI surfaces (rail, tabs, headers, drawers, settings, sheets, popovers, toasts) instead of message and composer content.
- Merged the separate settings and People badge observers into the existing page observer, removing two whole-document MutationObservers.
- People badge observation is child-list only; the continuous character-data workload is gone.
- Flair join/star-density measurements are throttled instead of running on every enhance.
- Badge scanning is reduced to every 1.5 s; targeted badge repairs still happen immediately.
- The bounded rain clip and flair behavior from 1.3.8/1.3.9 remain.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.10.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.10.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.10-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
