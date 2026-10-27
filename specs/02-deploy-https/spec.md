# 02 – Deploy with HTTPS

Status: approved

## Why
Phone browsers only allow microphone access and PWA installation over HTTPS, so the app must be deployed before it can be tried on a real phone. This spec also unblocks the mobile check of spec 01 (01-C3), which cannot be marked `implemented` until it passes on a real device.

## Scope
- Deploy the backend and the built frontend to a hosting provider that serves them over HTTPS on a public URL.
- Production wiring so the deployed frontend reaches the backend through `frontend/src/api/client.ts`.
- Production configuration: build and start commands, and environment variables.
- A repeatable deploy, either automatic from `main` or documented step by step.
- Run the pending mobile check of spec 01 on the deployed app.

## Out of scope
- Custom domain: the provider's default URL is used.
- Authentication and the access token (spec 03). Until then the deployed URL is public; this is acceptable because the app stores and sends nothing.
- Database and persistent storage (spec 04).
- Sending audio to the backend (spec 03).
- Offline behaviour beyond what the PWA service worker already does.

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **02-C1**: The app opens over `https://` on Android Chrome and iOS Safari and loads without errors (manual check on real phones).
- **02-C2**: The deployed frontend reaches the deployed backend: the health call made through `client.ts` succeeds in production (manual check, and a smoke test against the deployed URL).
- **02-C3**: Recording works on a real phone, on Android Chrome and iOS Safari: permission prompt, record, stop and playback. This satisfies 01-C3, and the results are noted in the tasks of both specs.
- **02-C4**: The app can be installed to the home screen from the browser, and opens in standalone mode (manual check).
- **02-C5**: Deploying is repeatable: pushing to `main` redeploys, or the README documents the exact steps (checked by following them).

## Edge cases
- Free tiers may put the service to sleep; the first request after idle can take 30-60 seconds. The app should still load, and the health check should not be reported as a failure just because it is slow.
- After a redeploy, the service worker may keep serving the old build. Check that `autoUpdate` picks up the new version.
- Frontend and backend on different origins would need CORS. How they talk in production (same domain or CORS) is decided in the plan.
- Microphone permission denied on the phone, or granted in the browser but not in the installed PWA (iOS standalone mode handles permissions separately): the readable error message from spec 01 must still appear.
- The deployed URL is public and unauthenticated until spec 03, so no secrets or real data may be exposed by this deploy.
