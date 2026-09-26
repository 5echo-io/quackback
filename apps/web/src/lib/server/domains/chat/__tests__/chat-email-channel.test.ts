import { describe, it, expect } from 'vitest'
import type { ConversationId } from '@quackback/ids'
import {
  isEmailInboundConfigured,
  inboundReplyToAddress,
  conversationIdFromInboundAddress,
  signConversationId,
  newConversationInboundAddresses,
  matchNewConversationAddress,
  isOwnInboundSender,
} from '../chat.email-channel'

// 'whsec_' + base64('testsecret') / base64('othersecret').
const ENV = {
  EMAIL_INBOUND_DOMAIN: 'tenaevexeo.resend.app',
  EMAIL_INBOUND_SIGNING_SECRET: 'whsec_dGVzdHNlY3JldA==',
}
const OTHER_ENV = { ...ENV, EMAIL_INBOUND_SIGNING_SECRET: 'whsec_b3RoZXJzZWNyZXQ=' }

// A short stand-in id for the string mechanics, and a real id: the
// `conversation_` prefix plus a full 26-char TypeID suffix whose full local part
// used to overflow the RFC 5321 limit; see #293.
const ID = 'conversation_abc' as ConversationId
const REAL_ID = 'conversation_01kw8qxn1eeh4t2rek7varh032' as ConversationId

const localPartOf = (address: string) => address.slice(0, address.indexOf('@'))

describe('isEmailInboundConfigured', () => {
  it('is true only when both the inbound domain and signing secret are set', () => {
    expect(isEmailInboundConfigured({})).toBe(false)
    expect(isEmailInboundConfigured({ EMAIL_INBOUND_DOMAIN: 'x.resend.app' })).toBe(false)
    expect(isEmailInboundConfigured({ EMAIL_INBOUND_SIGNING_SECRET: 'whsec_1' })).toBe(false)
    expect(
      isEmailInboundConfigured({
        EMAIL_INBOUND_DOMAIN: 'x.resend.app',
        EMAIL_INBOUND_SIGNING_SECRET: 'whsec_1',
      })
    ).toBe(true)
  })
})

describe('inboundReplyToAddress', () => {
  it('builds a signed plus-addressed reply address', () => {
    expect(inboundReplyToAddress(ID, ENV)).toMatch(
      /^reply\+abc\.[A-Za-z0-9_-]+@tenaevexeo\.resend\.app$/
    )
  })

  it('returns null when the inbound domain or signing secret is missing', () => {
    expect(inboundReplyToAddress(ID, {})).toBeNull()
    expect(inboundReplyToAddress(ID, { EMAIL_INBOUND_DOMAIN: 'tenaevexeo.resend.app' })).toBeNull()
  })

  // #293: a real 26-char TypeID suffix pushed the local part to 68, over the
  // RFC 5321 64-char limit, so strict providers (Resend) rejected the send.
  it('keeps the local part within the RFC 5321 64-char limit for a real id', () => {
    const addr = inboundReplyToAddress(REAL_ID, ENV)!
    expect(localPartOf(addr).length).toBeLessThanOrEqual(64)
  })

  it('embeds the bare TypeID suffix, not the redundant conversation_ prefix', () => {
    expect(inboundReplyToAddress(REAL_ID, ENV)).toMatch(
      /^reply\+01kw8qxn1eeh4t2rek7varh032\.[A-Za-z0-9_-]+@tenaevexeo\.resend\.app$/
    )
  })
})

describe('conversationIdFromInboundAddress', () => {
  it('round-trips a signed address back to the conversation id', () => {
    const addr = inboundReplyToAddress(ID, ENV)!
    expect(conversationIdFromInboundAddress(addr, ENV)).toBe(ID)
    // Tolerant of a display-name wrapper.
    expect(conversationIdFromInboundAddress(`Support <${addr}>`, ENV)).toBe(ID)
  })

  it('round-trips a real prefixed conversation id', () => {
    const addr = inboundReplyToAddress(REAL_ID, ENV)!
    expect(conversationIdFromInboundAddress(addr, ENV)).toBe(REAL_ID)
  })

  // Reply-tos minted before #293 embedded the full `conversation_<suffix>` id;
  // the parser must still route them so in-flight emails don't bounce.
  it('still parses a legacy full-prefix plus-address', () => {
    const sig = signConversationId(REAL_ID, ENV)
    const legacy = `reply+${REAL_ID}.${sig}@tenaevexeo.resend.app`
    expect(conversationIdFromInboundAddress(legacy, ENV)).toBe(REAL_ID)
  })

  it('rejects a tampered conversation id whose signature no longer matches', () => {
    const addr = inboundReplyToAddress(ID, ENV)!
    const tampered = addr.replace('reply+abc.', 'reply+evil.')
    expect(conversationIdFromInboundAddress(tampered, ENV)).toBeNull()
  })

  it('rejects an unsigned (legacy / forged) plus-address', () => {
    expect(
      conversationIdFromInboundAddress('reply+conversation_abc@tenaevexeo.resend.app', ENV)
    ).toBeNull()
  })

  it('rejects a signature minted with a different secret', () => {
    const addr = inboundReplyToAddress(ID, ENV)!
    expect(conversationIdFromInboundAddress(addr, OTHER_ENV)).toBeNull()
  })

  it('returns null for a non-plus-addressed recipient', () => {
    expect(conversationIdFromInboundAddress('bob@example.com', ENV)).toBeNull()
    expect(conversationIdFromInboundAddress('support@tenaevexeo.resend.app', ENV)).toBeNull()
  })
})

describe('newConversationInboundAddresses', () => {
  const WITH_ADDRESSES = {
    ...ENV,
    EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES:
      ' Support@Example.com, help@example.com ,,not-an-address',
  }

  it('parses the comma-separated list, lower-cased, skipping invalid entries', () => {
    expect([...newConversationInboundAddresses(WITH_ADDRESSES)]).toEqual([
      'support@example.com',
      'help@example.com',
    ])
  })

  it('is empty (off) when the variable is unset', () => {
    expect(newConversationInboundAddresses(ENV).size).toBe(0)
  })

  it('is empty (off) when the inbound channel itself is not configured', () => {
    expect(
      newConversationInboundAddresses({
        EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES: 'support@example.com',
      }).size
    ).toBe(0)
  })
})

describe('matchNewConversationAddress', () => {
  const WITH_ADDRESSES = {
    ...ENV,
    EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES: 'support@example.com',
  }

  it('matches a configured recipient case-insensitively, including a name-addr', () => {
    expect(matchNewConversationAddress(['SUPPORT@Example.COM'], WITH_ADDRESSES)).toBe(
      'support@example.com'
    )
    expect(
      matchNewConversationAddress(
        ['someone@else.com', 'Acme Support <support@example.com>'],
        WITH_ADDRESSES
      )
    ).toBe('support@example.com')
  })

  it('returns null for recipients that are not configured', () => {
    expect(matchNewConversationAddress(['sales@example.com'], WITH_ADDRESSES)).toBeNull()
    expect(matchNewConversationAddress([], WITH_ADDRESSES)).toBeNull()
  })

  it('returns null when the feature is off', () => {
    expect(matchNewConversationAddress(['support@example.com'], ENV)).toBeNull()
  })
})

describe('isOwnInboundSender', () => {
  const OWN = {
    ...ENV,
    EMAIL_FROM: 'Acme <notifications@acme.example>',
    EMAIL_INBOUND_NEW_CONVERSATION_ADDRESSES: 'support@acme.example',
  }

  it('recognizes the outbound EMAIL_FROM address', () => {
    expect(isOwnInboundSender('notifications@acme.example', OWN)).toBe(true)
  })

  it('recognizes any address on the inbound receiving domain', () => {
    expect(isOwnInboundSender('reply+abc.sig@tenaevexeo.resend.app', OWN)).toBe(true)
    expect(isOwnInboundSender('anything@TENAEVEXEO.resend.app', OWN)).toBe(true)
  })

  it('recognizes a configured support address', () => {
    expect(isOwnInboundSender('support@acme.example', OWN)).toBe(true)
  })

  it('does not match an ordinary sender, even on a lookalike domain', () => {
    expect(isOwnInboundSender('jane@example.com', OWN)).toBe(false)
    expect(isOwnInboundSender('jane@nottenaevexeo.resend.app', OWN)).toBe(false)
    expect(isOwnInboundSender('jane@acme.example', OWN)).toBe(false)
  })
})
