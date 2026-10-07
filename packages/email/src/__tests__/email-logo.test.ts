import { describe, it, expect } from 'vitest'
import { render } from '@react-email/components'
// Upstream's fallback. A board run by somebody else must never send it.
const VENDOR_LOGO = 'https://quackback.io/logo.png'
import { WelcomeEmail } from '../templates/welcome'
import { InvitationEmail } from '../templates/invitation'
import { MagicLinkEmail } from '../templates/magic-link'
import { PasswordResetEmail } from '../templates/password-reset'
import { StatusChangeEmail } from '../templates/status-change'
import { NewCommentEmail } from '../templates/new-comment'
import { ChangelogPublishedEmail } from '../templates/changelog-published'
import { FeedbackLinkedEmail } from '../templates/feedback-linked'

const BRAND_LOGO = 'https://example.com/api/storage/logos/brand-logo.png'

describe('email templates use brand logo when provided', () => {
  it('WelcomeEmail renders brand logo', async () => {
    const html = await render(
      WelcomeEmail({
        name: 'Alice',
        workspaceName: 'Acme',
        dashboardUrl: 'https://example.com/dashboard',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })

  it('InvitationEmail renders brand logo', async () => {
    const html = await render(
      InvitationEmail({
        invitedByName: 'Bob',
        organizationName: 'Acme',
        inviteLink: 'https://example.com/invite',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })

  it('MagicLinkEmail renders brand logo', async () => {
    const html = await render(
      MagicLinkEmail({
        signInUrl: 'https://example.com/verify-magic-link?token=abc',
        code: '123456',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('PasswordResetEmail renders brand logo', async () => {
    const html = await render(
      PasswordResetEmail({ resetLink: 'https://example.com/reset', logoUrl: BRAND_LOGO })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('StatusChangeEmail renders brand logo', async () => {
    const html = await render(
      StatusChangeEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        previousStatus: 'open',
        newStatus: 'in_progress',
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })

  it('NewCommentEmail renders brand logo', async () => {
    const html = await render(
      NewCommentEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        commenterName: 'Carol',
        commentPreview: 'Great idea',
        isTeamMember: false,
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })

  it('ChangelogPublishedEmail renders brand logo', async () => {
    const html = await render(
      ChangelogPublishedEmail({
        changelogTitle: 'v1.0',
        changelogUrl: 'https://example.com/changelog',
        contentPreview: 'New features',
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })

  it('FeedbackLinkedEmail renders brand logo', async () => {
    const html = await render(
      FeedbackLinkedEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        workspaceName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
        logoUrl: BRAND_LOGO,
      })
    )
    expect(html).toContain(BRAND_LOGO)
    expect(html).not.toContain(VENDOR_LOGO)
    expect(html).toContain('alt="Acme"')
  })
})

describe('without a logo, email templates never fall back to the vendor logo', () => {
  it('WelcomeEmail renders no vendor logo', async () => {
    const html = await render(
      WelcomeEmail({
        name: 'Alice',
        workspaceName: 'Acme',
        dashboardUrl: 'https://example.com/dashboard',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('InvitationEmail renders no vendor logo', async () => {
    const html = await render(
      InvitationEmail({
        invitedByName: 'Bob',
        organizationName: 'Acme',
        inviteLink: 'https://example.com/invite',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('MagicLinkEmail renders no vendor logo', async () => {
    const html = await render(
      MagicLinkEmail({
        signInUrl: 'https://example.com/verify-magic-link?token=abc',
        code: '123456',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('PasswordResetEmail renders no vendor logo', async () => {
    const html = await render(PasswordResetEmail({ resetLink: 'https://example.com/reset' }))
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('StatusChangeEmail renders no vendor logo', async () => {
    const html = await render(
      StatusChangeEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        previousStatus: 'open',
        newStatus: 'complete',
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('NewCommentEmail renders no vendor logo', async () => {
    const html = await render(
      NewCommentEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        commenterName: 'Carol',
        commentPreview: 'Great idea',
        isTeamMember: false,
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('ChangelogPublishedEmail renders no vendor logo', async () => {
    const html = await render(
      ChangelogPublishedEmail({
        changelogTitle: 'v1.0',
        changelogUrl: 'https://example.com/changelog',
        contentPreview: 'New features',
        organizationName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })

  it('FeedbackLinkedEmail renders no vendor logo', async () => {
    const html = await render(
      FeedbackLinkedEmail({
        postTitle: 'Test',
        postUrl: 'https://example.com/post/1',
        workspaceName: 'Acme',
        unsubscribeUrl: 'https://example.com/unsub',
      })
    )
    expect(html).not.toContain(VENDOR_LOGO)
  })
})
