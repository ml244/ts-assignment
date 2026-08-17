/**
 * Generates unique, throwaway test users for the signup flow.
 *
 * Emails are on the mail7.app disposable-inbox domain (see mail7Client.ts) —
 * a fresh address per user, never reused for anything sensitive.
 */

export interface TestUser {
  email: string;
  password: string;
  nickname: string;
  state: string;
}

/** Talkspace enforces nickname <= 10 characters ("Must be shorter than 11 characters."). */
function randomNickname(): string {
  const suffix = Math.random().toString(36).slice(2, 6); // 4 chars
  return `qa${suffix}`; // 6 chars total, well under the limit
}

function randomLocalPart(): string {
  return `ts-qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A password that satisfies length + strength requirements. */
export function validPassword(): string {
  return `Qa${Math.random().toString(36).slice(2, 8)}!9`;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    email: `${randomLocalPart()}@mail7.app`,
    password: validPassword(),
    nickname: randomNickname(),
    state: 'New York',
    ...overrides,
  };
}
