/**
 * Inbound email ingestion. A verified Resend `email.received` event is routed
 * into the conversation named by its plus-address (`reply+<id>@domain`) and the
 * visitor's stripped reply is appended through the normal visitor-message path,
 * so lifecycle (reopen), realtime publish and offline notification all behave
 * exactly as they do for a widget message — the polymorphic-conversation model.
 *
 * When `EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES` is set, fresh mail (no
 * plus-address) sent to one of those support addresses opens a NEW
 * conversation on the 'email' channel instead, with the sender as the visitor.
 * Agent replies then reach the sender through the same offline-notification
 * email (with a `reply+` Reply-To) as any other conversation. A plus-address
 * always wins: a reply that also CCs the support address still threads.
 *
 * The webhook route is the trust boundary (signature-verified); this assumes a
 * verified payload and never throws on an unroutable one — it returns a status
 * the route maps to a 200 (so the provider stops retrying a message we can't
 * place) and logs the reason.
 */
import { db, eq, sql, chatMessages, conversations, principal, user } from '@/lib/server/db'
import type { ConversationId, PrincipalId } from '@quackback/ids'
import type { Actor } from '@/lib/server/policy/types'
import { normalizePrincipalType } from '@/lib/server/functions/auth-helpers'
import { realEmail } from '@/lib/shared/anonymous-email'
import { isTeamMember } from '@/lib/shared/roles'
import { getReceivedEmail } from '@quackback/email'
import { identifyPortalUser } from '@/lib/server/domains/users/user.identify'
import {
  parseInboundEmail,
  extractReplyText,
  extractEmailAddress,
  extractDisplayName,
  htmlToText,
  isAutomatedEmail,
  type ParsedInboundEmail,
} from './chat.email-inbound'
import {
  conversationIdFromInboundAddress,
  isOwnInboundSender,
  matchNewConversationAddress,
} from './chat.email-channel'
import { assertChatSendRate, ChatRateLimitError } from './chat.ratelimit'
import { sendVisitorMessage } from './chat.service'

export type IngestInboundResult =
  | { status: 'ingested'; conversationId: ConversationId }
  | { status: 'created'; conversationId: ConversationId }
  | { status: 'duplicate' }
  | { status: 'no_conversation' }
  | { status: 'empty' }
  | { status: 'from_mismatch' }
  | { status: 'rate_limited' }
  | { status: 'invalid_sender' }
  | { status: 'own_sender' }
  | { status: 'automated' }
  | { status: 'team_member' }

/** Find the conversation id carried by any recipient plus-address. */
function conversationIdFromRecipients(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const id = conversationIdFromInboundAddress(addr)
    if (id) return id
  }
  return null
}

/** Whether a message with this provider Message-ID was already ingested. */
async function isDuplicateMessage(messageId: string | null): Promise<boolean> {
  if (!messageId) return false
  const [dupe] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(sql`${chatMessages.metadata} ->> 'emailMessageId' = ${messageId}`)
    .limit(1)
  return Boolean(dupe)
}

/** Plain-text body of a received email, preferring the text part. */
function receivedBodyText(full: { text: string | null; html: string | null } | null) {
  return full?.text ?? (full?.html ? htmlToText(full.html) : null)
}

export async function ingestInboundEmail(event: unknown): Promise<IngestInboundResult> {
  const data =
    (event && typeof event === 'object' ? (event as { data?: unknown }).data : null) ?? null
  const parsed = parseInboundEmail(data)

  const conversationId = conversationIdFromRecipients(parsed.toAddresses) as ConversationId | null
  if (!conversationId) {
    // Not a reply to one of our emails. Fresh mail to a configured support
    // address opens a conversation; anything else is unroutable, as before.
    const recipients = [...parsed.toAddresses, ...parsed.ccAddresses, ...parsed.bccAddresses]
    if (!matchNewConversationAddress(recipients)) return { status: 'no_conversation' }
    return openConversationFromEmail(parsed)
  }

  // Idempotency first: a redelivered Message-ID short-circuits before any other
  // read (the common retry case). The partial unique index on
  // (metadata->>'emailMessageId') is the hard backstop; this makes a retry a
  // graceful no-op instead of a unique-violation.
  if (await isDuplicateMessage(parsed.messageId)) return { status: 'duplicate' }

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  })
  if (!conversation) return { status: 'no_conversation' }

  // Resend's `email.received` webhook is metadata-only: the body must be
  // fetched from the Received Emails API (#320). Fetch after routing + dedupe
  // so unroutable/duplicate deliveries never cost an API call; a transient
  // fetch failure throws → the route 500s → Resend redelivers (idempotent).
  let bodyText = parsed.text
  if (bodyText === null && parsed.emailId) {
    bodyText = receivedBodyText(await getReceivedEmail(parsed.emailId))
  }

  const content = extractReplyText(bodyText ?? '')
  if (!content) return { status: 'empty' }

  const visitorPrincipalId = conversation.visitorPrincipalId as PrincipalId
  const visitor = await db.query.principal.findFirst({
    where: eq(principal.id, visitorPrincipalId),
  })
  if (!visitor) return { status: 'no_conversation' }

  // The Svix signature authenticates the delivery provider, not the sender:
  // the reply+ address is visible to anyone on the email thread (CC, forward),
  // so without this check any third party could inject messages attributed to
  // the visitor. The From must match an address we know for this visitor —
  // linked account email, principal contact email, or the captured pre-chat
  // email. realEmail() keeps synthetic anonymous placeholders out of the set;
  // an empty set means we never emailed this visitor, so nothing can match.
  const linkedUser = visitor.userId
    ? await db.query.user.findFirst({ where: eq(user.id, visitor.userId) })
    : null
  const knownAddresses = new Set(
    [linkedUser?.email, visitor.contactEmail, conversation.visitorEmail]
      .map((e) => realEmail(e))
      .filter((e): e is string => e !== null)
      .map((e) => e.toLowerCase())
  )
  const sender = extractEmailAddress(parsed.from)
  if (!sender || !knownAddresses.has(sender)) return { status: 'from_mismatch' }

  // Same per-visitor throttle the widget send path enforces — the inbound email
  // channel must not be an unbounded back door for the offline-notification
  // fanout (a visitor mail-looping replies, or a client retrying with fresh
  // Message-IDs). Fails open on Redis errors. Ack (200) so the provider stops.
  try {
    await assertChatSendRate(visitorPrincipalId)
  } catch (err) {
    if (err instanceof ChatRateLimitError) return { status: 'rate_limited' }
    throw err
  }

  const actor: Actor = {
    principalId: visitorPrincipalId,
    role: (visitor.role ?? null) as Actor['role'],
    principalType: normalizePrincipalType(visitor.type),
    segmentIds: new Set(),
  }

  await sendVisitorMessage(
    {
      conversationId,
      content,
      metadata: { source: 'email', emailMessageId: parsed.messageId ?? undefined },
    },
    { principalId: visitorPrincipalId, displayName: visitor.displayName },
    actor
  )

  return { status: 'ingested', conversationId }
}

/**
 * Open a new 'email'-channel conversation from fresh mail to a support address.
 * The sender becomes the visitor and the stripped body the first visitor
 * message, created through the same sendVisitorMessage path as a widget start
 * (inbox publish, auto-routing, team notification, webhooks).
 *
 * The From address is not authenticated — the webhook signature proves only
 * that the provider relayed the mail. So the sender is resolved through the
 * existing identify-by-email semantics and nothing more: a new address gets a
 * portal user with an UNVERIFIED email (verification still happens only at
 * sign-in), and an existing account is matched but never modified (no name,
 * avatar, attribute or verification change). A spoofed From can therefore at
 * most attribute a message; agent replies go to the real mailbox of that
 * address, never to the spoofer.
 */
async function openConversationFromEmail(parsed: ParsedInboundEmail): Promise<IngestInboundResult> {
  if (await isDuplicateMessage(parsed.messageId)) return { status: 'duplicate' }

  // realEmail() rejects the synthetic anonymous placeholder domain.
  const sender = realEmail(extractEmailAddress(parsed.from))
  if (!sender) return { status: 'invalid_sender' }
  // Never answer ourselves: a bounce or auto-reply to one of our own
  // notifications must not come back in as a visitor message (mail loop).
  if (isOwnInboundSender(sender)) return { status: 'own_sender' }
  if (isAutomatedEmail(sender, parsed.headers)) return { status: 'automated' }

  // A team member mailing the support address (e.g. forwarding a customer's
  // mail) must not become a visitor on their own inbox. Checked before any
  // write, so it creates nothing.
  const existingAccount = await db.query.user.findFirst({
    where: eq(user.email, sender),
    columns: { id: true },
    with: { principals: { columns: { role: true } } },
  })
  if (existingAccount?.principals.some((p) => isTeamMember(p.role))) {
    return { status: 'team_member' }
  }

  // The webhook is metadata-only (#320): fetch the body, and the headers the
  // auto-reply check needs, in one Received Emails API call. After the cheap
  // checks above, so ignored mail never costs a call; a transient failure
  // throws → the route 500s → Resend redelivers (idempotent).
  let bodyText = parsed.text
  let headers = parsed.headers
  if ((bodyText === null || headers === null) && parsed.emailId) {
    const full = await getReceivedEmail(parsed.emailId)
    bodyText = bodyText ?? receivedBodyText(full)
    headers = headers ?? full?.headers ?? null
  }
  if (isAutomatedEmail(sender, headers)) return { status: 'automated' }

  // A new message usually has no quoted history, but forwarded threads and
  // signatures do — strip them exactly as for a reply.
  const content = extractReplyText(bodyText ?? '')
  if (!content) return { status: 'empty' }

  // Identify by email only. For an existing account nothing else is passed, so
  // identify leaves it untouched; a new account takes the From display name.
  // emailVerified is never asserted — a From header proves nothing.
  const identified = await identifyPortalUser(
    existingAccount
      ? { email: sender }
      : { email: sender, name: extractDisplayName(parsed.from) ?? undefined }
  )
  const visitorPrincipalId = identified.principalId
  const visitor = await db.query.principal.findFirst({
    where: eq(principal.id, visitorPrincipalId),
  })
  if (!visitor) return { status: 'no_conversation' }
  if (isTeamMember(visitor.role)) return { status: 'team_member' }

  // Same per-visitor throttle as the reply path and the widget send path.
  try {
    await assertChatSendRate(visitorPrincipalId)
  } catch (err) {
    if (err instanceof ChatRateLimitError) return { status: 'rate_limited' }
    throw err
  }

  const actor: Actor = {
    principalId: visitorPrincipalId,
    role: (visitor.role ?? null) as Actor['role'],
    principalType: normalizePrincipalType(visitor.type),
    segmentIds: new Set(),
  }

  const result = await sendVisitorMessage(
    {
      content,
      channel: 'email',
      subject: parsed.subject ?? undefined,
      // Recorded as the conversation's contact address (and the principal's,
      // if it has none), so agent replies are emailed back to the sender.
      visitorEmail: sender,
      metadata: { source: 'email', emailMessageId: parsed.messageId ?? undefined },
    },
    {
      principalId: visitorPrincipalId,
      displayName: visitor.displayName ?? identified.name,
      email: sender,
    },
    actor
  )

  return { status: 'created', conversationId: result.conversation.id }
}
