import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@react-email/components'
import {
  configureEmailBrand,
  contrast,
  DEFAULT_BRAND,
  EmailBrandProvider,
  linkColor,
  resolveEmailBrand,
  sanitizeBrand,
  type EmailBrand,
} from '../brand'
import { InvitationEmail } from '../templates/invitation'
import { MagicLinkEmail } from '../templates/magic-link'
import { NewCommentEmail } from '../templates/new-comment'
import { PasswordResetEmail } from '../templates/password-reset'

const AVITELLO: EmailBrand = {
  primary: '#7e44d4',
  primaryForeground: '#ffffff',
  name: 'Avitello',
  logoUrl: null,
}

function withBrand(brand: EmailBrand, element: React.ReactElement) {
  return render(<EmailBrandProvider brand={brand}>{element}</EmailBrandProvider>)
}

const magicLink = () => MagicLinkEmail({ signInUrl: 'https://x.test/in', code: '123456' })

afterEach(() => configureEmailBrand(null))

describe('sanitizeBrand', () => {
  it('keeps hex colours, a name and an absolute logo URL', () => {
    expect(
      sanitizeBrand({
        primary: '#e2231a',
        primaryForeground: '#fff',
        name: ' Acme ',
        logoUrl: 'https://a.test/l.png',
      })
    ).toEqual({
      primary: '#e2231a',
      primaryForeground: '#fff',
      name: 'Acme',
      logoUrl: 'https://a.test/l.png',
    })
  })

  it('drops anything that is not a hex colour, field by field', () => {
    expect(sanitizeBrand({ primary: 'oklch(0.5 0.2 300)', name: 'Acme' })).toEqual({
      ...DEFAULT_BRAND,
      name: 'Acme',
    })
  })

  it('works out a readable foreground when none is given', () => {
    expect(sanitizeBrand({ primary: '#ffd43b' }).primaryForeground).toBe('#16181d')
    expect(sanitizeBrand({ primary: '#16181d' }).primaryForeground).toBe('#ffffff')
  })

  it('refuses a relative or non-http logo URL', () => {
    expect(sanitizeBrand({ logoUrl: '/api/storage/logo.png' }).logoUrl).toBeUndefined()
    expect(sanitizeBrand({ logoUrl: 'javascript:alert(1)' }).logoUrl).toBeUndefined()
  })
})

describe('resolveEmailBrand', () => {
  it('is neutral when nothing is registered', async () => {
    expect(await resolveEmailBrand()).toEqual(DEFAULT_BRAND)
  })

  it('asks the registered resolver', async () => {
    configureEmailBrand(async () => AVITELLO)
    expect(await resolveEmailBrand()).toMatchObject({ primary: '#7e44d4', name: 'Avitello' })
  })

  it('falls back to neutral when the resolver throws', async () => {
    configureEmailBrand(async () => {
      throw new Error('db down')
    })
    expect(await resolveEmailBrand()).toEqual(DEFAULT_BRAND)
  })
})

describe('linkColor', () => {
  it('uses the brand when it reads as text on white', () => {
    expect(linkColor(AVITELLO)).toBe('#7e44d4')
  })

  it('falls back to the body text for a brand too light to read', () => {
    const yellow = sanitizeBrand({ primary: '#ffd43b' })
    expect(contrast(yellow.primary, '#ffffff')).toBeLessThan(4.5)
    expect(linkColor(yellow)).toBe('#16181d')
  })
})

describe('templates wear the brand they are rendered with', () => {
  it('fills the button with the brand colour and its foreground', async () => {
    const html = await withBrand(AVITELLO, magicLink())
    expect(html).toMatch(/background-color:#7e44d4[^"]*color:#ffffff/)
    expect(html).not.toMatch(/#FFD43B/i)
  })

  it('names the board in the heading, and never the vendor', async () => {
    const html = await withBrand(AVITELLO, magicLink())
    expect(html).toContain('Sign in to <!-- -->Avitello')
    expect(html).not.toContain('Quackback')
  })

  it('shows the board name as a wordmark when there is no logo', async () => {
    const html = await withBrand(AVITELLO, PasswordResetEmail({ resetLink: 'https://x.test/r' }))
    expect(html).toContain('>Avitello</p>')
    expect(html).not.toContain('<img')
  })

  it('prefers a logo the caller passes over the brand name', async () => {
    const html = await withBrand(
      AVITELLO,
      PasswordResetEmail({ resetLink: 'https://x.test/r', logoUrl: 'https://a.test/logo.png' })
    )
    expect(html).toContain('src="https://a.test/logo.png"')
    expect(html).toContain('alt="Avitello"')
  })

  it('colours the bar beside a quoted comment', async () => {
    const html = await withBrand(
      AVITELLO,
      NewCommentEmail({
        postTitle: 'Dark mode',
        postUrl: 'https://x.test/p/1',
        commenterName: 'Eve',
        commentPreview: 'Yes please',
        isTeamMember: false,
        organizationName: 'Avitello',
        unsubscribeUrl: 'https://x.test/u',
      })
    )
    expect(html).toMatch(/width:3px;background-color:#7e44d4/)
  })

  it('renders neutral, with no product name, outside any brand', async () => {
    const html = await render(
      InvitationEmail({
        invitedByName: 'Bob',
        organizationName: 'Acme',
        inviteLink: 'https://x.test/i',
      })
    )
    expect(html).toContain(`background-color:${DEFAULT_BRAND.primary}`)
    expect(html).not.toContain('Quackback')
  })
})
