import { describe, it, expect } from 'vitest'
import {
  supportEnabled,
  supportRootView,
  contentSurfaceCount,
  homeEnabled,
  visibleTabs,
  resolveInitialTab,
  resolveInitialView,
  parseWidgetScope,
  scopeTabs,
} from '../widget-nav'

// Nav model: Chat is folded into the Help (support) surface, so the bottom bar
// is at most home | feedback | changelog | help. A "content surface" is
// feedback, changelog, or support (help OR chat). The aggregated Home appears
// only when 2+ content surfaces are enabled; otherwise the widget lands
// directly on the single surface and the bar is hidden.

describe('supportEnabled', () => {
  it('is true when help or chat is on', () => {
    expect(supportEnabled({ help: true })).toBe(true)
    expect(supportEnabled({ chat: true })).toBe(true)
    expect(supportEnabled({ help: true, chat: true })).toBe(true)
  })
  it('is false when neither help nor chat is on', () => {
    expect(supportEnabled({ feedback: true, changelog: true })).toBe(false)
    expect(supportEnabled({})).toBe(false)
  })
})

describe('supportRootView', () => {
  it('lands on the help articles when help is on', () => {
    expect(supportRootView({ help: true })).toBe('help')
    expect(supportRootView({ help: true, chat: true })).toBe('help')
  })
  it('lands on the messages list when only chat is on', () => {
    expect(supportRootView({ chat: true })).toBe('messages')
  })
})

describe('contentSurfaceCount', () => {
  it('counts feedback, changelog and support (help/chat collapse to one)', () => {
    expect(contentSurfaceCount({ feedback: true })).toBe(1)
    expect(contentSurfaceCount({ feedback: true, changelog: true })).toBe(2)
    expect(contentSurfaceCount({ feedback: true, help: true, chat: true })).toBe(2)
    expect(contentSurfaceCount({ help: true, chat: true })).toBe(1)
    expect(contentSurfaceCount({ feedback: true, changelog: true, help: true, chat: true })).toBe(3)
    expect(contentSurfaceCount({})).toBe(0)
  })
})

describe('homeEnabled', () => {
  it('is true only with 2+ content surfaces', () => {
    expect(homeEnabled({ feedback: true })).toBe(false)
    expect(homeEnabled({ help: true, chat: true })).toBe(false)
    expect(homeEnabled({ feedback: true, changelog: true })).toBe(true)
    expect(homeEnabled({ feedback: true, chat: true })).toBe(true)
  })
  it('defaults to shown when the home preference is omitted', () => {
    expect(homeEnabled({ feedback: true, changelog: true, home: undefined })).toBe(true)
  })
  it('honors the admin opt-out even with 2+ content surfaces', () => {
    expect(homeEnabled({ feedback: true, changelog: true, home: false })).toBe(false)
    expect(homeEnabled({ feedback: true, changelog: true, home: true })).toBe(true)
  })
  it('stays hidden with a single surface regardless of the home preference', () => {
    expect(homeEnabled({ feedback: true, home: true })).toBe(false)
  })
})

describe('visibleTabs', () => {
  it('prepends Home only when enabled and never exceeds four tabs', () => {
    expect(visibleTabs({ feedback: true })).toEqual(['feedback'])
    expect(visibleTabs({ feedback: true, changelog: true })).toEqual([
      'home',
      'feedback',
      'changelog',
    ])
    expect(visibleTabs({ feedback: true, changelog: true, help: true, chat: true })).toEqual([
      'home',
      'feedback',
      'changelog',
      'help',
    ])
  })
  it('shows a single support tab when only chat is on (no separate chat tab)', () => {
    expect(visibleTabs({ chat: true })).toEqual(['help'])
    expect(visibleTabs({ help: true, chat: true })).toEqual(['help'])
  })
  it('drops Home when the admin disables it', () => {
    expect(visibleTabs({ feedback: true, changelog: true, home: false })).toEqual([
      'feedback',
      'changelog',
    ])
  })
})

describe('resolveInitialTab', () => {
  it('lands on Home when 2+ content surfaces', () => {
    expect(resolveInitialTab({ feedback: true, changelog: true })).toBe('home')
    expect(resolveInitialTab({ feedback: true, help: true, chat: true })).toBe('home')
  })
  it('lands on the single enabled surface otherwise (support tab is "help")', () => {
    expect(resolveInitialTab({ feedback: true })).toBe('feedback')
    expect(resolveInitialTab({ changelog: true })).toBe('changelog')
    expect(resolveInitialTab({ help: true, chat: true })).toBe('help')
    expect(resolveInitialTab({ chat: true })).toBe('help')
  })
  it('lands on the first surface when the admin disables Home', () => {
    expect(resolveInitialTab({ feedback: true, changelog: true, home: false })).toBe('feedback')
  })
})

describe('resolveInitialView', () => {
  it('lands on overview when Home is enabled', () => {
    expect(resolveInitialView({ feedback: true, changelog: true })).toBe('overview')
    expect(resolveInitialView({ feedback: true, help: true, chat: true })).toBe('overview')
  })
  it('lands on the single surface root otherwise', () => {
    expect(resolveInitialView({ feedback: true })).toBe('feedback')
    expect(resolveInitialView({ changelog: true })).toBe('changelog')
    expect(resolveInitialView({ help: true })).toBe('help')
    expect(resolveInitialView({ help: true, chat: true })).toBe('help')
    expect(resolveInitialView({ chat: true })).toBe('messages')
  })
  it('lands on the first surface root when the admin disables Home', () => {
    expect(resolveInitialView({ feedback: true, changelog: true, home: false })).toBe('feedback')
  })
})

describe('parseWidgetScope', () => {
  it('accepts the two named doors', () => {
    expect(parseWidgetScope('support')).toBe('support')
    expect(parseWidgetScope('feedback')).toBe('feedback')
  })
  it('treats anything else as the whole widget', () => {
    expect(parseWidgetScope(undefined)).toBe('all')
    expect(parseWidgetScope('all')).toBe('all')
    expect(parseWidgetScope('chat')).toBe('all')
    expect(parseWidgetScope({ scope: 'support' })).toBe('all')
  })
})

describe('scopeTabs', () => {
  const everything = { feedback: true, changelog: true, help: true, chat: true }

  it('leaves the admin config untouched for the whole widget', () => {
    expect(scopeTabs(everything, 'all')).toBe(everything)
  })

  it('support keeps only the support surface, with no Home and no tab bar', () => {
    const scoped = scopeTabs(everything, 'support')
    expect(visibleTabs(scoped)).toEqual(['help'])
    expect(resolveInitialView(scoped)).toBe('help')
    expect(resolveInitialView(scopeTabs({ feedback: true, chat: true }, 'support'))).toBe(
      'messages'
    )
  })

  it('feedback keeps the board and the changelog, landing on the board', () => {
    const scoped = scopeTabs(everything, 'feedback')
    expect(visibleTabs(scoped)).toEqual(['feedback', 'changelog'])
    expect(resolveInitialTab(scoped)).toBe('feedback')
    expect(resolveInitialView(scoped)).toBe('feedback')
  })

  it('never switches on a surface the admin turned off', () => {
    expect(scopeTabs({ feedback: true, chat: true }, 'feedback').changelog).toBeFalsy()
    expect(scopeTabs({ feedback: true, chat: true }, 'support').help).toBeFalsy()
  })

  it('ignores a scope that would leave nothing to show', () => {
    const feedbackOnly = { feedback: true, changelog: true }
    expect(scopeTabs(feedbackOnly, 'support')).toBe(feedbackOnly)
    const supportOnly = { help: true, chat: true }
    expect(scopeTabs(supportOnly, 'feedback')).toBe(supportOnly)
  })
})
