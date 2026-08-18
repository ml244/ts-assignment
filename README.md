# Talkspace signup E2E tests

Playwright + TypeScript functional tests for the signup and email
verification flow at `/signup/autoswitchpt` on canary.

## Setup

```bash
npm install
npx playwright install chromium   # first time only
cp .env.example .env               # defaults are already correct
npm test
```

No API keys are required. Email verification codes are fetched from
[Mail7](https://mail7.app), a free, unauthenticated disposable-inbox
service used purely as a test inbox (see `helpers/mail7Client.ts`) — a
fresh `test-<uuid>@mail7.app` address is generated per test run.

## Layout

- `helpers/testUser.ts` — generates unique test users.
- `helpers/mail7Client.ts` — polls Mail7 for the verification email and
  extracts the 6-digit OTP.
- `pages/SignupPage.ts`, `pages/EmailVerificationPage.ts` — page objects.
- `tests/registration.spec.ts` — the "Create account" form (tests 1–6).
- `tests/email-verification.spec.ts` — the OTP screen (tests 7–10).

## How to run tests
To run all tests from terminal use `npm test`.
To run a specific test from terminal use `npx playwright test -g "<test name>"`.
To run tests using playwright chromium ui use `npx playwright test --ui`.

## A note on flakiness

These are true end-to-end tests against two live external systems: the
canary environment itself, and Mail7. Both introduce latency/consistency
variance outside this repo's control — most visibly, the "resend code"
email consistently arrives slower than the initial one (test 9 gives it a
longer budget accordingly), and running tests concurrently was observed to
cause cross-contaminated/timed-out email lookups. Because of that,
`playwright.config.ts` runs everything strictly one test at a time
(`workers: 1`, `fullyParallel: false`) rather than the Playwright default —
don't override this with `--workers` unless you're deliberately
re-diagnosing that flakiness.

If a run shows an isolated failure on one of the email round-trip tests
(7–10, or 5), re-run it on its own first —
`npx playwright test -g "<test name>"` — before assuming a regression;
`retries: 1` locally / `2` on CI already absorbs most of this automatically.
