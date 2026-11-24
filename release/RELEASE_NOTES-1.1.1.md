# Better Agnostr 1.1.1 — Teleport omission, client control, matcha theme

**Teleport-tag omission is now enforced on the final signed frame, the redundant native client broadcast switch is gone, and there is a new matcha theme and reading serif.**

## Fixed

- Omit-teleport now removes `t=teleport` case-insensitively before signing and checks the final outgoing signed frame again before it reaches a relay.
- The redundant native **Broadcast Agnostr client** switch is hidden and disabled; the Better Agnostr **Client** tab is the single client-tag control.

## Added

- **Iced Matcha Latte** light theme.
- **Literata** serif font, tuned for readable long-form text.

## Downloads

- `better-agnostr-1.1.1.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.1.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
