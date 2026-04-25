# Project Guidelines

## Architecture
- This repository is an Angular app. Primary API access code is in `src/app/services/api.service.ts` and domain logic in `src/app/services/garden.service.ts`.
- UI components are under `src/app/components/**`.

## Build and Test
- Install dependencies: `npm install`
- Start app: `npm start`
- Run tests: `npm test`
- Use existing VS Code tasks where possible (`npm: start`, `npm: test`).

## Conventions
- Keep changes scoped to requested behavior and preserve existing component/service patterns.
- Do not add or modify SCSS unless explicitly requested by the user.
- For webshop references, only use `gartenland.com`.
- Prefer fixing root causes in TypeScript/HTML over cosmetic-only edits.
- For review requests, focus first on defects, regressions, and missing tests.
