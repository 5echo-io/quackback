/**
 * Inbound email parsing for the email channel, kept pure so it's unit-tested
 * directly. Resend posts an `email.received` event whose `data` carries the
 * parsed message; we normalize the shape we depend on and strip quoted reply
 * history so the ingested chat message is only what the visitor actually wrote.
 */

export interface ParsedInboundEmail {
  /** Recipient addresses (one is our plus-addressed `reply+<id>@domain`). */
  toAddresses: string[]
  /** Cc / Bcc recipients as the provider reports them — only consulted when
   *  matching a new-conversation support address, never for reply routing. */
  ccAddresses: string[]
  bccAddresses: string[]
  from: string | null
  subject: string | null
  text: string | null
  /** Provider Message-ID (header preferred, email id as fallback) for dedupe. */
  messageId: string | null
  /** Provider email id (Resend `email_id`) — used to fetch the body when the
   *  webhook payload is metadata-only (Resend `email.received`, #320). */
  emailId: string | null
  /** Raw headers when the payload carries them (Resend's webhook does not; the
   *  Received Emails API does). Read with `readHeader`. */
  headers: unknown
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** A string-or-array address field, normalized to a string array. */
function asAddressList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((t): t is string => typeof t === 'string')
  return typeof v === 'string' ? [v] : []
}

/** Read a header value case-insensitively from either an array of
 *  `{name,value}` entries or a plain object map. */
function readHeader(headers: unknown, name: string): string | null {
  const want = name.toLowerCase()
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (
        h &&
        typeof h === 'object' &&
        String((h as { name?: unknown }).name).toLowerCase() === want
      ) {
        return asString((h as { value?: unknown }).value)
      }
    }
    return null
  }
  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (k.toLowerCase() === want) return asString(v)
    }
  }
  return null
}

/**
 * Pull the addr-spec out of a From header value (`Jane <jane@x>` or a bare
 * address), normalized to lower case. Returns null when no plausible single
 * address is present — callers treat that as "sender unknown", never as a
 * wildcard match.
 */
export function extractEmailAddress(raw: string | null): string | null {
  if (!raw) return null
  const angled = raw.match(/<([^<>]+)>\s*$/)
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase()
  if (!candidate || /[\s<>,;"]/.test(candidate)) return null
  const at = candidate.indexOf('@')
  if (at <= 0 || at !== candidate.lastIndexOf('@') || at === candidate.length - 1) return null
  return candidate
}

/**
 * The display name of a From header value (`"Jane Doe" <jane@x>` → `Jane Doe`),
 * or null for a bare address, an empty name, or a still-encoded (RFC 2047)
 * word we can't render as a name.
 */
export function extractDisplayName(raw: string | null): string | null {
  if (!raw) return null
  const angled = raw.match(/^(.*)<[^<>]+>\s*$/)
  if (!angled) return null
  const name = angled[1]
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/\\(.)/g, '$1')
    .trim()
  if (!name || name.includes('=?')) return null
  return name.slice(0, 255)
}

// Sender local parts that only ever carry delivery reports, never a person.
const AUTOMATED_SENDER_LOCAL_PARTS = new Set(['mailer-daemon', 'postmaster'])

// `Precedence` values set by list servers and vacation responders.
const AUTOMATED_PRECEDENCE = new Set(['bulk', 'junk', 'list', 'auto_reply'])

/**
 * Whether an inbound email was machine-generated — an auto-reply, bounce, or
 * mailing-list / bulk message — and so must never open a conversation (it
 * would otherwise answer our own notification and loop, or file a newsletter
 * as a support request). Checks the sender and, when available, the headers
 * RFC 3834 and common list/bounce practice define for exactly this.
 */
export function isAutomatedEmail(sender: string, headers: unknown): boolean {
  const localPart = sender.slice(0, sender.indexOf('@')).toLowerCase()
  if (AUTOMATED_SENDER_LOCAL_PARTS.has(localPart)) return true

  const autoSubmitted = readHeader(headers, 'auto-submitted')?.trim().toLowerCase()
  if (autoSubmitted && autoSubmitted !== 'no') return true

  const precedence = readHeader(headers, 'precedence')?.trim().toLowerCase()
  if (precedence && AUTOMATED_PRECEDENCE.has(precedence)) return true

  if (
    readHeader(headers, 'list-id') ||
    readHeader(headers, 'list-unsubscribe') ||
    readHeader(headers, 'x-autoreply') ||
    readHeader(headers, 'x-autorespond') ||
    readHeader(headers, 'x-failed-recipients')
  ) {
    return true
  }

  // A null reverse-path (`Return-Path: <>`) marks a delivery status notification.
  if (readHeader(headers, 'return-path')?.trim() === '<>') return true

  const contentType = readHeader(headers, 'content-type')?.toLowerCase() ?? ''
  return contentType.startsWith('multipart/report')
}

export function parseInboundEmail(data: unknown): ParsedInboundEmail {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return {
    toAddresses: asAddressList(d.to),
    ccAddresses: asAddressList(d.cc),
    bccAddresses: asAddressList(d.bcc),
    from: asString(d.from),
    subject: asString(d.subject),
    text: asString(d.text),
    messageId:
      readHeader(d.headers, 'message-id') ??
      asString(d.message_id) ??
      asString(d.email_id) ??
      asString(d.id),
    emailId: asString(d.email_id) ?? asString(d.id),
    headers: d.headers ?? null,
  }
}

/**
 * Naive HTML→text for received emails that carry only an HTML body. Enough to
 * feed extractReplyText — block tags become newlines, entities are unescaped.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&') // last, so &amp;lt; unescapes only one level
      .replace(/[ \t]+\n/g, '\n')
      // Strip per-line leading whitespace left by inline-tag removal — the
      // quote separators extractReplyText cuts on are ^-anchored.
      .replace(/^[ \t]+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

// Lines that mark the start of quoted history from common mail clients. These
// are deliberately well-anchored — a bare `From:` is NOT here because it occurs
// in ordinary prose and a top-level cut on it would silently drop real text.
const QUOTE_SEPARATORS = [
  /^On\s.+\swrote:\s*$/i, // Gmail / Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  /^_{5,}\s*$/, // Outlook divider
]

/** A line that starts quoted history or a signature block. */
function isCutLine(line: string): boolean {
  // "-- " (trims to "--") is the standard signature delimiter.
  return line.trimEnd() === '--' || QUOTE_SEPARATORS.some((re) => re.test(line))
}

/**
 * Trim quoted reply history and a trailing signature so the stored message is
 * just the visitor's new text. Conservative: cut at the first quote separator
 * or signature delimiter, then drop a fully-quoted trailing block.
 *
 * If that empties the message (e.g. a client put the attribution line first),
 * fall back to the visitor's own non-quoted lines rather than silently dropping
 * a real reply — but a genuinely all-quoted reply still resolves to empty.
 */
export function extractReplyText(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')

  let cut = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (isCutLine(lines[i])) {
      cut = i
      break
    }
  }

  const kept = lines.slice(0, cut)
  // Drop any trailing run of quoted (`>`) lines and blank lines left behind.
  while (kept.length > 0) {
    const last = kept[kept.length - 1].trim()
    if (last === '' || last.startsWith('>')) kept.pop()
    else break
  }
  const result = kept.join('\n').trim()
  if (result) return result

  // Recovery: keep any non-blank, non-quoted, non-separator line the visitor
  // actually wrote. All-quoted/separator-only input correctly stays empty.
  return lines
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('>') && !isCutLine(l))
    .join('\n')
    .trim()
}
