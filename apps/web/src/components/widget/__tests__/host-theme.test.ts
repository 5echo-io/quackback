// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyHostMode, applyHostTheme, isHexColor } from '../host-theme'

const root = () => document.documentElement
const prop = (name: string) => root().style.getPropertyValue(name)

describe('isHexColor', () => {
  it('accepts 3, 4, 6 and 8 digit hex in either case', () => {
    for (const ok of ['#fff', '#ffff', '#7E44D4', '#7e44d4cc']) expect(isHexColor(ok)).toBe(true)
  })
  it('rejects anything that could carry more than a colour', () => {
    for (const bad of [
      'red',
      '#7e44d4; background: url(https://x.test/a.png)',
      'url(https://x.test/a.png)',
      'var(--primary)',
      'oklch(0.5 0.2 300)',
      '#7e44d',
      ' #7e44d4',
      7,
      null,
    ])
      expect(isHexColor(bad)).toBe(false)
  })
})

describe('applyHostTheme', () => {
  beforeEach(() => root().removeAttribute('style'))

  it('sets primary, its foreground and the focus ring', () => {
    applyHostTheme({ primary: '#e2231a', primaryForeground: '#ffffff' })
    expect(prop('--primary')).toBe('#e2231a')
    expect(prop('--ring')).toBe('#e2231a')
    expect(prop('--primary-foreground')).toBe('#ffffff')
  })

  it('clears an invalid value instead of keeping the previous one', () => {
    applyHostTheme({ primary: '#e2231a', primaryForeground: '#ffffff' })
    applyHostTheme({ primary: 'url(https://x.test/a.png)', primaryForeground: '#000000' })
    expect(prop('--primary')).toBe('')
    expect(prop('--ring')).toBe('')
    expect(prop('--primary-foreground')).toBe('#000000')
  })

  it('clears everything for an empty message, letting the instance theme through', () => {
    applyHostTheme({ primary: '#e2231a', primaryForeground: '#ffffff' })
    applyHostTheme(null)
    expect(prop('--primary')).toBe('')
    expect(prop('--primary-foreground')).toBe('')
  })

  it('fans each surface out to the tokens that play its role', () => {
    applyHostTheme({
      background: '#fafafa',
      foreground: '#191919',
      card: '#ffffff',
      muted: '#f5f5f5',
      mutedForeground: '#666666',
      border: '#e8e8e8',
    })
    expect(prop('--background')).toBe('#fafafa')
    for (const name of ['--foreground', '--card-foreground', '--popover-foreground'])
      expect(prop(name)).toBe('#191919')
    expect(prop('--card')).toBe('#ffffff')
    expect(prop('--popover')).toBe('#ffffff')
    for (const name of ['--muted', '--secondary', '--accent']) expect(prop(name)).toBe('#f5f5f5')
    expect(prop('--muted-foreground')).toBe('#666666')
    expect(prop('--border')).toBe('#e8e8e8')
    expect(prop('--input')).toBe('#e8e8e8')
  })

  it('leaves the instance surfaces in place for a host that sends only a primary', () => {
    applyHostTheme({ primary: '#e2231a' })
    expect(prop('--background')).toBe('')
    expect(prop('--border')).toBe('')
  })

  it('leaves unrelated inline properties alone', () => {
    root().style.setProperty('--radius', '0.5rem')
    applyHostTheme({ primary: '#e2231a' })
    applyHostTheme(null)
    expect(prop('--radius')).toBe('0.5rem')
  })
})

describe('applyHostMode', () => {
  const html = () => document.documentElement
  // MutationObserver callbacks run as microtasks.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  beforeEach(() => {
    applyHostMode(undefined)
    html().className = 'light'
    html().removeAttribute('style')
  })

  it("puts the host's mode on <html>, class and color-scheme", () => {
    applyHostMode('dark')
    expect(html().classList.contains('dark')).toBe(true)
    expect(html().classList.contains('light')).toBe(false)
    expect(html().style.colorScheme).toBe('dark')
  })

  it('replaces the unresolved system class too', () => {
    html().className = 'system'
    applyHostMode('light')
    expect(html().className).toBe('light')
  })

  it('holds the mode when next-themes re-applies its own', async () => {
    applyHostMode('dark')
    // What next-themes does when the OS preference changes under `system`.
    html().classList.remove('dark')
    html().classList.add('light')
    await settle()
    expect(html().classList.contains('dark')).toBe(true)
    expect(html().classList.contains('light')).toBe(false)
  })

  it('lets go when a later message carries no mode', async () => {
    applyHostMode('dark')
    applyHostMode(undefined)
    html().classList.replace('dark', 'light')
    await settle()
    expect(html().className).toBe('light')
  })

  it('ignores anything but light or dark', () => {
    for (const bad of ['system', 'DARK', 'dark light', 1, null]) {
      applyHostMode(bad)
      expect(html().className).toBe('light')
    }
  })

  it('arrives with the colours in one message', () => {
    applyHostTheme({ primary: '#e2231a', mode: 'dark' })
    expect(html().classList.contains('dark')).toBe(true)
    expect(html().style.getPropertyValue('--primary')).toBe('#e2231a')
  })

  it('persists nothing — no theme cookie, no stored theme', () => {
    applyHostMode('dark')
    expect(document.cookie).not.toContain('theme')
    expect(window.localStorage.getItem('theme')).toBeNull()
  })
})
