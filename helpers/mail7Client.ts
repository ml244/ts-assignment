/**
 * Client for Mail7 (https://mail7.app), used purely as a disposable,
 * API-readable test inbox for Talkspace's email verification codes.
 *
 * Reverse-engineered from the live network call the mail7.app portal makes
 * (no official docs, no auth, no signup):
 *
 *   GET https://api.mail7.app/api/emails?address={address}
 *   -> { emails: [{ id, to, from, subject, receivedAt, hasHtml, html, ... }], pagination: {...} }
 *
 * Any "<anything>@mail7.app" address works immediately — there's no
 * "create inbox" call, and no API key. The list response already inlines
 * the full quoted-printable-encoded HTML body, so no per-message fetch is
 * needed either.
 */

const MAIL7_API_BASE = 'https://api.mail7.app/api';

interface Mail7Email {
  id: string;
  to: string;
  from: string;
  subject: string;
  receivedAt: string;
  hasHtml: boolean;
  html?: string;
}

interface Mail7ListResponse {
  emails: Mail7Email[];
}

/** Minimal quoted-printable decoder (no external dependency needed). */
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r\n/g, '') // soft line breaks
    .replace(/=\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

async function listEmails(address: string): Promise<Mail7Email[]> {
  const res = await fetch(`${MAIL7_API_BASE}/emails?address=${encodeURIComponent(address)}`);
  if (!res.ok) {
    throw new Error(`Mail7 list request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Mail7ListResponse;
  return data.emails ?? [];
}

/**
 * Polls the Mail7 inbox for `address` until a message whose subject matches
 * `subjectContains` (case-insensitive) arrives, then extracts the 6-digit
 * OTP from its body.
 */
export async function waitForVerificationCode(
  address: string,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    subjectContains?: string;
    /** Skip these message ids — use when re-polling after "resend" to force picking up the new email. */
    excludeIds?: string[];
  } = {},
): Promise<{ code: string; id: string }> {
  const { timeoutMs = 30_000, pollIntervalMs = 2_000, subjectContains = 'verify', excludeIds = [] } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const emails = await listEmails(address);
    const match = emails
      .filter((e) => e.subject?.toLowerCase().includes(subjectContains.toLowerCase()))
      .filter((e) => !excludeIds.includes(e.id))
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0];

    if (match?.html) {
      const code = extractOtp(match.html);
      if (code) return { code, id: match.id };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for a verification email at ${address}`);
}

/** Returns the raw list of emails currently in the inbox (newest first). */
export async function getInbox(address: string): Promise<Mail7Email[]> {
  const emails = await listEmails(address);
  return emails.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

/**
 * Extracts the 6-digit OTP from a (quoted-printable, HTML) email body.
 *
 * Anchored to Talkspace's known copy ("...this code to verify your email
 * address. This code will expire after N minutes. <code>") rather than
 * grabbing the first bare 6-digit run in the document — the raw HTML also
 * contains SendGrid tracking pixels/ids that can coincidentally be 6 digits
 * and appear earlier in the text.
 */
export function extractOtp(html: string): string | null {
  const text = stripHtmlTags(decodeQuotedPrintable(html));
  const anchored = text.match(/expire after \d+ minutes?\.\s*(\d{6})/i);
  if (anchored) return anchored[1];
  const fallback = text.match(/\b\d{6}\b/);
  return fallback ? fallback[0] : null;
}
