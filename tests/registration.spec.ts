import { test, expect } from '@playwright/test';
import { SignupPage } from '../pages/SignupPage';
import { EmailVerificationPage } from '../pages/EmailVerificationPage';
import { createTestUser, validPassword } from '../helpers/testUser';
import { waitForVerificationCode } from '../helpers/mail7Client';

test.describe('Signup — registration form', () => {
  test('1. valid data registers and reaches the email verification screen', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const user = createTestUser();

    await signupPage.goto();
    await signupPage.fillAndSubmit(user);

    await expect(page).toHaveURL(/\/email-verification\/otp/, { timeout: 15_000 });
    await expect(page.getByText(`We sent a one-time code to ${user.email}`)).toBeVisible();
  });

  test('2. submitting an empty form shows every required-field error', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.goto();
    await signupPage.submit();

    await expect(signupPage.emailRequiredError).toBeVisible();
    await expect(signupPage.passwordRequiredError).toBeVisible();
    await expect(signupPage.nicknameRequiredError).toBeVisible();
    await expect(signupPage.stateRequiredError).toBeVisible();
    await expect(page).toHaveURL(/\/signup\/autoswitchpt/);
  });

  test('3. an invalid email format is rejected', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const user = createTestUser({ email: 'not-an-email' });

    await signupPage.goto();
    await signupPage.emailInput.fill(user.email);
    await signupPage.passwordInput.fill(user.password);
    await signupPage.submit();

    // No custom in-page error copy exists for this case — the native
    // type="email" constraint blocks submission and shows the browser's own
    // validation popup instead (manually confirmed: "Please include an '@'
    // in the email address."), readable via validationMessage since the
    // popup itself isn't part of the DOM/accessibility tree.
    await expect(async () => {
      expect(await signupPage.isEmailFieldNativelyInvalid()).toBe(true);
    }).toPass({ timeout: 5_000 });
    expect(await signupPage.getEmailValidationMessage()).toMatch(/include an ['’]@['’] in the email address/i);
    await expect(page).toHaveURL(/\/signup\/autoswitchpt/);
  });

  test('4. a password under 8 characters is rejected with a weak-strength indicator', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.goto();
    await signupPage.passwordInput.fill('abc123');
    await signupPage.passwordInput.blur();

    await expect(signupPage.passwordTooShortError).toBeVisible();
    await expect(page.getByText('Strength: Weak')).toBeVisible();
  });

  test('5. re-registering an already-verified email goes to the generic "email sent" screen, not a duplicate-account error', async ({
    page,
  }) => {
    const signupPage = new SignupPage(page);
    const emailVerificationPage = new EmailVerificationPage(page);
    const user = createTestUser();

    // First, fully register and verify a real account for this email.
    await signupPage.goto();
    await signupPage.fillAndSubmit(user);
    await expect(page).toHaveURL(/\/email-verification\/otp/, { timeout: 15_000 });

    const { code } = await waitForVerificationCode(user.email);
    await emailVerificationPage.enterCode(code);
    await emailVerificationPage.expectVerified();

    // Re-submitting signup with the same (now verified) email should not
    // reveal that the account already exists.
    await signupPage.goto();
    await signupPage.fillAndSubmit({ ...user, nickname: `${user.nickname}b` });

    await emailVerificationPage.expectEmailSentScreen(user.email);
  });

  test('6. leaving the state unselected blocks submission even with everything else valid', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const user = createTestUser({ password: validPassword() });

    await signupPage.goto();
    await signupPage.fillAndSubmit(user, { skipState: true });

    await expect(signupPage.stateRequiredError).toBeVisible();
    await expect(page).toHaveURL(/\/signup\/autoswitchpt/);
  });
});
