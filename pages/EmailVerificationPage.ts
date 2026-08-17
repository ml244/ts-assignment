import { Locator, Page, expect } from '@playwright/test';

/**
 * Page object covering the two email-verification screens reachable after
 * submitting the signup form:
 *
 *  - `/email-verification/otp?...` — 6-digit code entry (fresh signup).
 *  - `/email-verification/sent#...` — generic "we sent you an email" screen
 *    (used, among other cases, for a repeat signup with an
 *    already-verified email — no explicit duplicate-account error is shown,
 *    to avoid leaking whether an account exists).
 *
 * The OTP inputs are the one part of this flow with stable, purpose-built
 * locators (`aria-label="Input verification code N"`) — everything else is
 * matched by visible copy, confirmed via live exploration.
 */
export class EmailVerificationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // --- OTP entry screen ---

  codeInput(position: 1 | 2 | 3 | 4 | 5 | 6): Locator {
    return this.page.getByLabel(`Input verification code ${position}`);
  }

  get resendCodeButton(): Locator {
    return this.page.getByRole('button', { name: /resend code/i });
  }

  /**
   * Clicks "Resend code" and waits for the underlying API call to actually
   * complete, rather than just the click event — otherwise polling the
   * inbox can start racing ahead of the server having accepted the resend.
   *
   * The button is never DOM-`disabled` (confirmed live: no disabled state,
   * no visible cooldown, for at least 20s after landing on this screen),
   * yet a click here has been observed to sometimes not fire the
   * `/otp/resend` request at all — an apparent silent no-op in the app
   * itself, not a Playwright actionability issue. Retry with a real pause
   * between attempts rather than trusting a single click.
   */
  async resendCode() {
    const isResendCall = (res: import('@playwright/test').Response) =>
      res.url().includes('/v2/auth/email-verification/otp/resend') && res.request().method() === 'POST';

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await expect(this.resendCodeButton).toBeEnabled();
      try {
        const [response] = await Promise.all([
          this.page.waitForResponse(isResendCall, { timeout: 20_000 }),
          this.resendCodeButton.click(),
        ]);
        if (!response.ok()) {
          throw new Error(`Resend request failed: ${response.status()} ${response.statusText()}`);
        }
        return;
      } catch (err) {
        lastError = err;
        await this.page.waitForTimeout(3_000);
      }
    }
    throw new Error(`Clicking "Resend code" never triggered the resend request after 3 attempts: ${lastError}`);
  }

  get updateEmailButton(): Locator {
    return this.page.getByRole('button', { name: 'Update email' });
  }

  get otpErrorMessage(): Locator {
    return this.page.getByText('Error validating OTP', { exact: true });
  }

  get verifiedSuccessMessage(): Locator {
    return this.page.getByText('Your email has been verified', { exact: true });
  }

  /**
   * Types the 6-digit code across the individual inputs; the form
   * auto-submits once the 6th digit lands.
   *
   * Tried adding a post-fill DOM readback here to guard against a
   * suspected fill race — that made failures *worse* (turned intermittent
   * flakiness into a 100%-reproducible one): the auto-submit fires and the
   * app clears/transitions the boxes right after the 6th digit, so the
   * readback caught that transition, misread it as a mismatch, and
   * re-submitted the same single-use code a second time (which fails by
   * design — see test 10). Reverted; a plain fill loop is correct.
   */
  async enterCode(code: string) {
    if (!/^\d{6}$/.test(code)) {
      throw new Error(`Expected a 6-digit code, got "${code}"`);
    }
    for (let i = 0; i < 6; i++) {
      await this.codeInput((i + 1) as 1 | 2 | 3 | 4 | 5 | 6).fill(code[i]);
    }
  }

  async expectVerified() {
    await expect(this.verifiedSuccessMessage).toBeVisible({ timeout: 10_000 });
  }

  async expectOtpError() {
    await expect(this.otpErrorMessage).toBeVisible({ timeout: 10_000 });
  }

  // --- "Email sent" screen (link-based, e.g. duplicate/already-verified email) ---

  emailSentMessage(email: string): Locator {
    return this.page.getByText(`We sent an email with a verification link to ${email}`, {
      exact: false,
    });
  }

  get resendEmailButton(): Locator {
    return this.page.getByRole('button', { name: 'Resend email' });
  }

  async expectEmailSentScreen(email: string) {
    await expect(this.page).toHaveURL(/\/email-verification\/sent/);
    await expect(this.emailSentMessage(email)).toBeVisible();
  }
}
