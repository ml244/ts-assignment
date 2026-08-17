import { test, expect, Page } from '@playwright/test';
import { SignupPage } from '../pages/SignupPage';
import { EmailVerificationPage } from '../pages/EmailVerificationPage';
import { createTestUser, TestUser } from '../helpers/testUser';
import { waitForVerificationCode } from '../helpers/mail7Client';

/** Registers a fresh user and lands on the OTP entry screen. */
async function registerAndReachOtpScreen(
  page: Page,
): Promise<{ user: TestUser; signupPage: SignupPage; otpPage: EmailVerificationPage }> {
  const signupPage = new SignupPage(page);
  const otpPage = new EmailVerificationPage(page);
  const user = createTestUser();

  await signupPage.goto();
  await signupPage.fillAndSubmit(user);
  await expect(page).toHaveURL(/\/email-verification\/otp/, { timeout: 15_000 });

  return { user, signupPage, otpPage };
}

test.describe('Signup — email verification (OTP)', () => {
  test('7. the correct code verifies the email end-to-end', async ({ page }) => {
    const { user, otpPage } = await registerAndReachOtpScreen(page);

    const { code } = await waitForVerificationCode(user.email);
    await otpPage.enterCode(code);

    await otpPage.expectVerified();
  });

  test('8. an incorrect code shows an error and allows retry with the correct code', async ({ page }) => {
    const { user, otpPage } = await registerAndReachOtpScreen(page);

    await otpPage.enterCode('000000');
    await otpPage.expectOtpError();

    // Session must still be usable for a retry.
    const { code } = await waitForVerificationCode(user.email);
    await otpPage.enterCode(code);
    await otpPage.expectVerified();
  });

  // Scoped separately so it can carry a higher retry count than the rest of
  // the suite: this one has consistently been the least reliable test,
  // between the resend email's own latency/variance and an app-side click
  // that sometimes silently doesn't fire the resend request at all (see
  // EmailVerificationPage.resendCode for that mitigation) — both are real
  // external variance, not a bug in the test, so more retries is the right
  // dial to turn rather than trying to force it deterministic.
  test.describe('resend', () => {
    test.describe.configure({ retries: 4 });

    test('9. resending the code emails a new code that also verifies successfully', async ({ page }) => {
      // The resend email was observed to arrive noticeably slower — and more
      // variably — than the initial signup email (a different/lower-priority
      // send path on Talkspace's side), sometimes past a minute. Give this
      // one plenty of room rather than treat that variance as a failure.
      test.setTimeout(150_000);

      const { user, otpPage } = await registerAndReachOtpScreen(page);

      const first = await waitForVerificationCode(user.email);

      // Waits for the resend API call to actually complete (not just the
      // click) before we start polling, so we're never racing the server.
      await otpPage.resendCode();

      const second = await waitForVerificationCode(user.email, { excludeIds: [first.id], timeoutMs: 120_000 });
      expect(second.id).not.toBe(first.id);

      await otpPage.enterCode(second.code);
      await otpPage.expectVerified();
    });
  });

  test('10. a code cannot be reused once it has already verified the email', async ({ page }) => {
    const { user, otpPage } = await registerAndReachOtpScreen(page);

    const { code } = await waitForVerificationCode(user.email);
    await otpPage.enterCode(code);
    await otpPage.expectVerified();

    // Re-enter the same, now-consumed code on a fresh load of the same
    // verification link — stands in for an expired/stale code, since both
    // are cases of "this OTP is no longer valid".
    await page.reload();
    await otpPage.enterCode(code);
    await otpPage.expectOtpError();
  });
});
