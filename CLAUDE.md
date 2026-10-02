# Claude Code guidance

- Preserve the non-explicit adult-romance, scene-pacing, and accurate-anatomy behavior in `windlass/` and its regression coverage. Do not remove or weaken these user-requested requirements or `test/romance-anatomy.js` unless the user explicitly asks.
- Run `npm run romance-anatomy` from `test/` whenever changing the shared scene prompt or world romance/anatomy rules.
- Do not invent anatomical structures or functions absent from the world data. Keep sex off-page while allowing neutral, specific descriptions of established anatomy.
