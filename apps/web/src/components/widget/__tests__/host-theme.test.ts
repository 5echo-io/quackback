// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyHostTheme, isHexColor } from '../host-theme'

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

  it('leaves unrelated inline properties alone', () => {
    root().style.setProperty('--radius', '0.5rem')
    applyHostTheme({ primary: '#e2231a' })
    applyHostTheme(null)
    expect(prop('--radius')).toBe('0.5rem')
  })
})
