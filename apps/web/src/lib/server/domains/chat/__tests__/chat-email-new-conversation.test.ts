/**
 * Inbound email to a support address: fresh mail (no plus-address) sent to an
 * address in EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES opens a new 'email'
 * conversation with the sender as the visitor. Covers the gating (off by
 * default, configured addresses only, plus-address still wins), the safety
 * checks (auto-replies, our own senders, team members, dedupe, rate limit) and
 * how the sender is resolved (identify by email, never verified, an existing
 * account left untouched).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inboundReplyToAddress } from '../chat.email-channel'

const ENV = {
  EMAIL_INBOUND_DOMAIN: 'tenaevexeo.resend.app',
  EMAIL_INBOUND_SIGNING_SECRET: 'whsec_dGVzdHNlY3JldA==',
  EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES: 'support@acme.example, help@acme.example',
  EMAIL_FROM: 'Acme <notifications@acme.example>',
}
Object.assign(process.env, ENV)
const REPLY_TO = inboundReplyToAddress('conversation_abc')!

const sendVisitorMessage = vi.fn()
const assertChatSendRate = vi.fn()
const getReceivedEmail = vi.fn()
const identifyPortalUser = vi.fn()

vi.mock('@quackback/email', () => ({
  getReceivedEmail: (...a: unknown[]) => getReceivedEmail(...a),
}))

vi.mock('@/lib/server/domains/users/user.identify', () => ({
  identifyPortalUser: (...a: unknown[]) => identifyPortalUser(...a),
}))

vi.mock('../chat.service', () => ({
  sendVisitorMessage: (...a: unknown[]) => sendVisitorMessage(...a),
}))

vi.mock('../chat.ratelimit', () => ({
  assertChatSendRate: (...a: unknown[]) => assertChatSendRate(...a),
  ChatRateLimitError: class ChatRateLimitError extends Error {
    readonly code = 'RATE_LIMITED'
    readonly retryAfter = 5
  },
}))

let conversationRow: Record<string, unknown> | undefined
let principalRow: Record<string, unknown> | undefined
let existingUserRow: Record<string, unknown> | undefined
let dupeRows: Array<Record<string, unknown>> = []

vi.mock('@/lib/server/db', () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: async () => dupeRows,
  }
  return {
    db: {
      query: {
        conversations: { findFirst: async () => conversationRow },
        principal: { findFirst: async () => principalRow },
        user: { findFirst: async () => existingUserRow },
      },
      select: () => selectChain,
    },
    eq: vi.fn(),
    sql: Object.assign(() => ({}), { raw: () => ({}) }),
    chatMessages: { metadata: 'metadata' },
    conversations: { id: 'id' },
    principal: { id: 'id' },
    user: { id: 'id', email: 'email' },
  }
})

import { ingestInboundEmail } from '../chat.email-inbound.service'

// Resend's `email.received` webhook shape: metadata only, no body or headers.
const baseEvent = {
  type: 'email.received',
  data: {
    email_id: 'em_new_1',
    message_id: '<new-1@mail.example.com>',
    to: ['support@acme.example'],
    cc: [],
    bcc: [],
    from: 'Jane Visitor <jane@example.com>',
    subject: 'My order never arrived',
  },
}

function withData(data: Record<string, unknown>) {
  return { ...baseEvent, data: { ...baseEvent.data, ...data } }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(process.env, ENV)
  conversationRow = undefined
  existingUserRow = undefined
  dupeRows = []
  principalRow = {
    id: 'principal_new',
    type: 'user',
    role: 'user',
    displayName: 'Jane Visitor',
    contactEmail: null,
    userId: 'user_new',
  }
  getReceivedEmail.mockResolvedValue({
    text: 'Order #123 was due last week.\n\n-- \nJane',
    html: null,
    headers: { 'Message-ID': '<new-1@mail.example.com>' },
  })
  identifyPortalUser.mockResolvedValue({
    principalId: 'principal_new',
    name: 'Jane Visitor',
    created: true,
  })
  sendVisitorMessage.mockResolvedValue({
    conversation: { id: 'conversation_new' },
    message: { id: 'chat_msg_new' },
    created: true,
  })
  assertChatSendRate.mockResolvedValue(undefined)
})

describe('ingestInboundEmail: new conversation from a support address', () => {
  it('opens an email conversation with the sender as the visitor', async () => {
    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'created', conversationId: 'conversation_new' })
    expect(identifyPortalUser).toHaveBeenCalledWith({
      email: 'jane@example.com',
      name: 'Jane Visitor',
    })
    expect(sendVisitorMessage).toHaveBeenCalledTimes(1)
    const [input, author, actor] = sendVisitorMessage.mock.calls[0]
    // No conversationId: this send creates the conversation.
    expect(input).toEqual({
      content: 'Order #123 was due last week.',
      channel: 'email',
      subject: 'My order never arrived',
      visitorEmail: 'jane@example.com',
      metadata: { source: 'email', emailMessageId: '<new-1@mail.example.com>' },
    })
    expect(author).toMatchObject({
      principalId: 'principal_new',
      displayName: 'Jane Visitor',
      email: 'jane@example.com',
    })
    expect(actor).toMatchObject({
      principalId: 'principal_new',
      role: 'user',
      principalType: 'user',
    })
  })

  it('never asserts the sender email as verified', async () => {
    await ingestInboundEmail(baseEvent)

    const [identifyInput] = identifyPortalUser.mock.calls[0]
    expect(identifyInput).not.toHaveProperty('emailVerified')
  })

  it('leaves an existing account untouched (identify by email only, no name)', async () => {
    existingUserRow = { id: 'user_existing', principals: [{ role: 'user' }] }
    identifyPortalUser.mockResolvedValue({
      principalId: 'principal_existing',
      name: 'Jane Existing',
      created: false,
    })
    principalRow = { ...principalRow!, id: 'principal_existing', displayName: 'Jane Existing' }

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'created', conversationId: 'conversation_new' })
    expect(identifyPortalUser).toHaveBeenCalledWith({ email: 'jane@example.com' })
    const [, author] = sendVisitorMessage.mock.calls[0]
    expect(author).toMatchObject({
      principalId: 'principal_existing',
      displayName: 'Jane Existing',
    })
  })

  it('matches the support address in Cc', async () => {
    const result = await ingestInboundEmail(
      withData({ to: ['someone@else.example'], cc: ['help@acme.example'] })
    )

    expect(result).toEqual({ status: 'created', conversationId: 'conversation_new' })
  })

  it('matches the support address and sender case-insensitively', async () => {
    const result = await ingestInboundEmail(
      withData({ to: ['Acme Support <SUPPORT@Acme.Example>'], from: 'JANE@Example.com' })
    )

    expect(result).toEqual({ status: 'created', conversationId: 'conversation_new' })
    expect(identifyPortalUser).toHaveBeenCalledWith({ email: 'jane@example.com' })
  })

  it('ignores mail to an address that is not configured (no_conversation)', async () => {
    const result = await ingestInboundEmail(withData({ to: ['sales@acme.example'] }))

    expect(result).toEqual({ status: 'no_conversation' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('is off when EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES is unset', async () => {
    delete process.env.EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'no_conversation' })
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('is off when the inbound channel itself is not configured', async () => {
    delete process.env.EMAIL_INBOUND_SIGNING_SECRET

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'no_conversation' })
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('still threads a plus-addressed reply that also includes the support address', async () => {
    conversationRow = { id: 'conversation_abc', visitorPrincipalId: 'principal_v' }
    principalRow = {
      id: 'principal_v',
      type: 'anonymous',
      displayName: 'Jane',
      contactEmail: 'jane@example.com',
      userId: null,
    }

    const result = await ingestInboundEmail(
      withData({ to: [REPLY_TO, 'support@acme.example'], from: 'jane@example.com' })
    )

    expect(result).toEqual({ status: 'ingested', conversationId: 'conversation_abc' })
    expect(identifyPortalUser).not.toHaveBeenCalled()
    const [input] = sendVisitorMessage.mock.calls[0]
    expect(input).toMatchObject({ conversationId: 'conversation_abc' })
    expect(input).not.toHaveProperty('channel')
  })

  it('fetches the body and headers once for a metadata-only payload', async () => {
    await ingestInboundEmail(baseEvent)

    expect(getReceivedEmail).toHaveBeenCalledTimes(1)
    expect(getReceivedEmail).toHaveBeenCalledWith('em_new_1')
  })

  it('falls back to html→text when the fetched email has no plain-text body', async () => {
    getReceivedEmail.mockResolvedValueOnce({
      text: null,
      html: '<p>Hello from html</p>',
      headers: {},
    })

    await ingestInboundEmail(baseEvent)

    const [input] = sendVisitorMessage.mock.calls[0]
    expect(input).toMatchObject({ content: 'Hello from html' })
  })

  it('does not call the Received Emails API when the payload carries text and headers', async () => {
    const result = await ingestInboundEmail(
      withData({ text: 'Inline body', headers: [{ name: 'X-Mailer', value: 'test' }] })
    )

    expect(result).toEqual({ status: 'created', conversationId: 'conversation_new' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
  })

  it('drops an empty message without creating an account', async () => {
    getReceivedEmail.mockResolvedValueOnce({ text: '   ', html: null, headers: {} })

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'empty' })
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('propagates a transient Received Emails API failure so the delivery is retried', async () => {
    getReceivedEmail.mockRejectedValueOnce(new Error('received-email fetch failed: boom'))

    await expect(ingestInboundEmail(baseEvent)).rejects.toThrow('received-email fetch failed')
    expect(identifyPortalUser).not.toHaveBeenCalled()
  })

  it('is a no-op for a redelivered Message-ID (dedupe) and makes no API call', async () => {
    dupeRows = [{ id: 'chat_msg_existing' }]

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'duplicate' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('ignores an auto-reply flagged in the fetched headers', async () => {
    getReceivedEmail.mockResolvedValueOnce({
      text: 'I am out of the office until Monday.',
      html: null,
      headers: { 'Auto-Submitted': 'auto-replied' },
    })

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'automated' })
    expect(getReceivedEmail).toHaveBeenCalledTimes(1)
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('ignores mailing-list and bulk mail', async () => {
    getReceivedEmail.mockResolvedValueOnce({
      text: 'This week in news',
      html: null,
      headers: { 'List-Id': '<news.example.com>', Precedence: 'bulk' },
    })

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'automated' })
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('ignores a bounce from the mailer daemon without fetching it', async () => {
    const result = await ingestInboundEmail(
      withData({ from: 'Mail Delivery System <MAILER-DAEMON@mx.example.com>' })
    )

    expect(result).toEqual({ status: 'automated' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
    expect(identifyPortalUser).not.toHaveBeenCalled()
  })

  it('never opens a conversation from our own outbound address (mail loop)', async () => {
    const result = await ingestInboundEmail(withData({ from: 'notifications@acme.example' }))

    expect(result).toEqual({ status: 'own_sender' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
    expect(identifyPortalUser).not.toHaveBeenCalled()
  })

  it('never opens a conversation from the inbound domain or a support address', async () => {
    expect(await ingestInboundEmail(withData({ from: 'reply+x.y@tenaevexeo.resend.app' }))).toEqual(
      { status: 'own_sender' }
    )
    expect(await ingestInboundEmail(withData({ from: 'help@acme.example' }))).toEqual({
      status: 'own_sender',
    })
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('does not make a team member a visitor (distinct status, nothing created)', async () => {
    existingUserRow = { id: 'user_agent', principals: [{ role: 'member' }] }

    const result = await ingestInboundEmail(withData({ from: 'agent@acme.example' }))

    expect(result).toEqual({ status: 'team_member' })
    expect(getReceivedEmail).not.toHaveBeenCalled()
    expect(identifyPortalUser).not.toHaveBeenCalled()
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })

  it('drops a missing, malformed or synthetic sender', async () => {
    const noFrom: Record<string, unknown> = { ...baseEvent.data }
    delete noFrom.from
    expect(await ingestInboundEmail({ ...baseEvent, data: noFrom })).toEqual({
      status: 'invalid_sender',
    })
    expect(await ingestInboundEmail(withData({ from: 'not an address' }))).toEqual({
      status: 'invalid_sender',
    })
    expect(await ingestInboundEmail(withData({ from: 'temp-abc@anon.quackback.io' }))).toEqual({
      status: 'invalid_sender',
    })
    expect(identifyPortalUser).not.toHaveBeenCalled()
  })

  it('rate-limits the sender (acks without creating a conversation)', async () => {
    const { ChatRateLimitError } = await import('../chat.ratelimit')
    assertChatSendRate.mockRejectedValueOnce(new ChatRateLimitError(5))

    const result = await ingestInboundEmail(baseEvent)

    expect(result).toEqual({ status: 'rate_limited' })
    expect(assertChatSendRate).toHaveBeenCalledWith('principal_new')
    expect(sendVisitorMessage).not.toHaveBeenCalled()
  })
})
