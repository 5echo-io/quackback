// @vitest-environment happy-dom
/**
 * `quackback:theme` from the host re-colours the widget. The colour rules
 * themselves are covered in host-theme.test.ts; this pins the wiring — the
 * provider listens for the message, and only from the embedding page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/client/widget-auth', () => ({
  setWidgetToken: vi.fn(),
  clearWidgetToken: vi.fn(),
  getWidgetToken: vi.fn(() => null),
  persistAnonymousToken: vi.fn(),
  readPersistedToken: vi.fn(() => null),
  clearPersistedToken: vi.fn(),
}))
vi.mock('@/lib/client/widget-bridge', () => ({ sendToHost: vi.fn() }))
vi.mock('@/lib/client/auth-client', () => ({
  authClient: { signIn: { anonymous: vi.fn().mockResolvedValue({ data: null, error: null }) } },
}))
vi.mock('@/lib/server/functions/widget', () => ({ createWidgetIdentifyTokenFn: vi.fn() }))
vi.mock('@/lib/shared/i18n', async (orig) => ({
  ...(await orig<typeof import('@/lib/shared/i18n')>()),
  loadMessages: vi.fn().mockResolvedValue({}),
}))

import { WidgetAuthProvider } from '../widget-auth-provider'

function renderWidget() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WidgetAuthProvider>
        <span />
      </WidgetAuthProvider>
    </QueryClientProvider>
  )
}

function post(data: unknown, source: MessageEventSource | null) {
  window.dispatchEvent(
    new MessageEvent('message', { data: { type: 'quackback:theme', data }, source })
  )
}

const primary = () => document.documentElement.style.getPropertyValue('--primary')

describe('WidgetAuthProvider host theme', () => {
  beforeEach(() => document.documentElement.removeAttribute('style'))

  it('applies the colours the embedding page sends', () => {
    renderWidget()
    post({ primary: '#00857c', primaryForeground: '#ffffff' }, window.parent)
    expect(primary()).toBe('#00857c')
  })

  it('ignores the message from anything but the embedding page', () => {
    renderWidget()
    post({ primary: '#00857c' }, null)
    expect(primary()).toBe('')
  })
})
