/**
 * The brand the board's emails are sent in comes from its own settings: name,
 * logo, and the light theme's primary as hex.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSettingsFindFirst = vi.fn()

vi.mock('@/lib/server/db', () => ({
  db: { query: { settings: { findFirst: (...a: unknown[]) => mockSettingsFindFirst(...a) } } },
}))
vi.mock('@/lib/server/storage/s3', () => ({
  getEmailSafeUrl: vi.fn((key: string | null) => (key ? `https://cdn.test/${key}` : null)),
}))

import { emailHex, getEmailBrand } from '../email-brand'

beforeEach(() => vi.clearAllMocks())

describe('emailHex', () => {
  it('passes hex through', () => {
    expect(emailHex('#7e44d4')).toBe('#7e44d4')
  })

  it('converts plain oklch', () => {
    expect(emailHex('oklch(0.535 0.209 297)')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('refuses what it cannot convert rather than answering black', () => {
    expect(emailHex('oklch(53.5% 0.209 297)')).toBeUndefined()
    expect(emailHex('var(--primary)')).toBeUndefined()
    expect(emailHex(undefined)).toBeUndefined()
  })
})

describe('getEmailBrand', () => {
  it("takes the name, the logo and the light theme's primary", async () => {
    mockSettingsFindFirst.mockResolvedValue({
      name: 'Avitello',
      logoKey: 'logos/a.png',
      brandingConfig: JSON.stringify({
        light: { primary: 'oklch(0.535 0.209 297)' },
        dark: { primary: 'oklch(0.541 0.247 293)' },
      }),
    })
    const brand = await getEmailBrand()
    expect(brand.name).toBe('Avitello')
    expect(brand.logoUrl).toBe('https://cdn.test/logos/a.png')
    expect(brand.primary).toBe(emailHex('oklch(0.535 0.209 297)'))
    // Dark-enough primary: the portal's light foreground.
    expect(brand.primaryForeground).toBe(emailHex('oklch(0.985 0 0)'))
  })

  it('leaves the foreground to the email package for a hex primary', async () => {
    mockSettingsFindFirst.mockResolvedValue({
      name: 'Acme',
      logoKey: null,
      brandingConfig: JSON.stringify({ light: { primary: '#ffd43b' } }),
    })
    expect(await getEmailBrand()).toEqual({
      name: 'Acme',
      logoUrl: null,
      primary: '#ffd43b',
      primaryForeground: undefined,
    })
  })

  it('has no colour for a board with no theme', async () => {
    mockSettingsFindFirst.mockResolvedValue({ name: 'Acme', logoKey: null, brandingConfig: null })
    const brand = await getEmailBrand()
    expect(brand.primary).toBeUndefined()
    expect(brand.name).toBe('Acme')
  })
})
