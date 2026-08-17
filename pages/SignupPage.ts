import { Locator, Page, expect } from '@playwright/test';
import type { TestUser } from '../helpers/testUser';

/**
 * Page object for the "Create account" step at /signup/autoswitchpt.
 *
 * Field ids in the rendered DOM (e.g. `inputId6`) are auto-generated and
 * shift between builds, so every locator here is by placeholder/role/text
 * instead.
 */
export class SignupPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/signup/autoswitchpt');
    await expect(this.page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  }

  get emailInput(): Locator {
    return this.page.getByPlaceholder('Email');
  }

  get passwordInput(): Locator {
    return this.page.getByPlaceholder('Enter password');
  }

  get nicknameInput(): Locator {
    return this.page.getByPlaceholder('Enter nickname');
  }

  get stateField(): Locator {
    // Custom react-select combobox — click to focus, then type + Enter.
    return this.page.getByText('State', { exact: true }).first();
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Create account' });
  }

  async selectState(stateName: string) {
    await this.stateField.click();
    await this.page.keyboard.type(stateName);
    // The combobox is a react-select instance that filters as you type; a
    // short settle is more reliable here than matching its visually-hidden
    // aria-live announcement text.
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
  }

  /** Fills every field. Pass `{ skipState: true }` to leave state unselected. */
  async fillForm(user: TestUser, options: { skipState?: boolean } = {}) {
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.nicknameInput.fill(user.nickname);
    if (!options.skipState) {
      await this.selectState(user.state);
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async fillAndSubmit(user: TestUser, options: { skipState?: boolean } = {}) {
    await this.fillForm(user, options);
    await this.submit();
  }

  // --- Validation error locators (exact copy confirmed via live testing) ---

  get emailRequiredError(): Locator {
    return this.page.getByText('Please enter an email.', { exact: true });
  }

  /**
   * There is no custom in-page "invalid format" copy for the email field —
   * a malformed address is blocked purely by the native `type="email"`
   * constraint, surfaced as the browser's own validation popup (e.g.
   * "Please include an '@' in the email address."), not DOM text. Read via
   * the `validationMessage` API since the popup itself isn't queryable.
   */
  async isEmailFieldNativelyInvalid(): Promise<boolean> {
    return this.emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
  }

  async getEmailValidationMessage(): Promise<string> {
    return this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  get passwordRequiredError(): Locator {
    return this.page.getByText('Please enter a password.', { exact: true });
  }

  get passwordTooShortError(): Locator {
    return this.page.getByText('Password must be at least 8 characters.', { exact: true });
  }

  get nicknameRequiredError(): Locator {
    return this.page.getByText('Please enter a nickname.', { exact: true });
  }

  get nicknameTooLongError(): Locator {
    return this.page.getByText('Must be shorter than 11 characters.', { exact: true });
  }

  get stateRequiredError(): Locator {
    return this.page.getByText('Please select a state.', { exact: true });
  }
}
