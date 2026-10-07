/**
 * The profile a verified ssoToken carries reaches the principal, not only the
 * user row.
 *
 * Posts, comments, voters and the avatar map read `principal.display_name`
 * and `principal.avatar_url`. Identify used to write those once, when the
 * principal was created, so a photo or name changed in the host app showed in
 * the widget header and nowhere else — and a photo removed there stayed on
 * the board for good.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUserFindFirst = vi.fn()
const mockPrincipalFindFirst = vi.fn()
const mockSessionFindFirst = vi.fn()
const insertValues = vi.fn()
const updateSet = vi.fn()
const mockVerifyJWT = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (opts: unknown) => ({ options: opts })),
}))

vi.mock('@/lib/server/db', () => ({
  db: {
    query: {
      user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
      session: { findFirst: (...args: unknown[]) => mockSessionFindFirst(...args) },
      principal: { findFirst: (...args: unknown[]) => mockPrincipalFindFirst(...args) },
      segments: { findFirst: vi.fn() },
    },
    insert: () => ({
      values: (v: unknown) => {
        insertValues(v)
        return {
          returning: async () => [{ id: 'inserted' }],
          onConflictDoUpdate: async () => undefined,
        }
      },
    }),
    update: () => ({
      set: (s: unknown) => {
        updateSet(s)
        return { where: async () => undefined }
      },
    }),
  },
  user: { externalId: 'external_id' },
  session: {},
  principal: {},
  segments: {},
  widgetIdentifiedSession: { sessionId: 'session_id' },
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn((parts: TemplateStringsArray) => parts.raw[0]),
}))

vi.mock('@/lib/server/domains/settings/settings.widget', () => ({
  getWidgetConfig: vi.fn(async () => ({ enabled: true, identifyVerification: false })),
  getWidgetSecret: vi.fn(async () => 'secret'),
}))

vi.mock('@/lib/server/domains/posts/post.public', () => ({
  getAllUserVotedPostIds: vi.fn(async () => new Set()),
}))

vi.mock('@/lib/server/storage/s3', () => ({
  getPublicUrlOrNull: vi.fn(() => null),
}))

vi.mock('@/lib/server/auth/identify-merge', () => ({
  resolveAndMergeAnonymousToken: vi.fn(),
}))

vi.mock('@/lib/server/widget/identity-token', () => ({
  verifyHS256JWT: (...args: unknown[]) => mockVerifyJWT(...args),
}))

vi.mock('@/lib/server/domains/users/user.attributes', () => ({
  validateAndCoerceAttributes: vi.fn(async () => ({ valid: {}, removals: [], errors: [] })),
  mergeMetadata: vi.fn(() => null),
}))

vi.mock('@/lib/server/domains/segments/segment-membership.service', () => ({
  addMember: vi.fn(async () => undefined),
  reconcileWidgetMemberships: vi.fn(async () => undefined),
}))

vi.mock('@quackback/ids', () => ({
  generateId: vi.fn((kind: string) => `${kind}_generated`),
}))

import { avatarFromClaims, Route } from '../identify'

type RouteOpts = {
  server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } }
}
const { POST } = (Route as unknown as { options: RouteOpts }).options.server.handlers

function postIdentify(body: Record<string, unknown>): Promise<Response> {
  return POST({
    request: new Request('http://test/api/widget/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSessionFindFirst.mockResolvedValue(null)
})

const existingUser = (over: Record<string, unknown> = {}) => ({
  id: 'user_eve',
  email: 'eve@acme.com',
  externalId: 'sub_eve',
  name: 'Eve',
  image: 'https://cdn.acme.test/eve-old.jpg',
  metadata: null,
  ...over,
})

/** The `set` calls that carry a principal's profile. */
function principalProfileWrites(): Record<string, unknown>[] {
  return updateSet.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .filter((s) => s && 'displayName' in s)
}

describe('avatarFromClaims', () => {
  it('takes either spelling of the claim', () => {
    expect(avatarFromClaims({ avatarURL: 'https://a.test/1.jpg' }, true)).toBe(
      'https://a.test/1.jpg'
    )
    expect(avatarFromClaims({ avatarUrl: 'https://a.test/2.jpg' }, true)).toBe(
      'https://a.test/2.jpg'
    )
  })

  it('reads an explicit null as "no photo" on a verified token only', () => {
    expect(avatarFromClaims({ avatarUrl: null }, true)).toBeNull()
    expect(avatarFromClaims({ avatarUrl: null }, false)).toBeUndefined()
  })

  it('leaves the photo alone when the claim is absent', () => {
    expect(avatarFromClaims({}, true)).toBeUndefined()
  })
})

describe('POST /api/widget/identify — principal profile sync', () => {
  it('carries a changed photo and name onto an existing principal', async () => {
    mockVerifyJWT.mockReturnValue({
      sub: 'sub_eve',
      email: 'eve@acme.com',
      name: 'Eve Holt',
      avatarUrl: 'https://cdn.acme.test/eve-new.jpg',
    })
    mockUserFindFirst.mockResolvedValueOnce(existingUser())
    mockPrincipalFindFirst.mockResolvedValue({
      id: 'principal_eve',
      role: 'user',
      displayName: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })

    const res = await postIdentify({ ssoToken: 'jwt' })

    expect(res.status).toBe(200)
    expect(principalProfileWrites()).toEqual([
      { displayName: 'Eve Holt', avatarUrl: 'https://cdn.acme.test/eve-new.jpg' },
    ])
    // The response is built from what was just written, not the stale row.
    expect((await res.json()).user.avatarUrl).toBe('https://cdn.acme.test/eve-new.jpg')
  })

  it('repairs a principal that drifted before this request', async () => {
    // The user row is already current; only the principal is behind.
    mockVerifyJWT.mockReturnValue({
      sub: 'sub_eve',
      email: 'eve@acme.com',
      name: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })
    mockUserFindFirst.mockResolvedValueOnce(existingUser())
    mockPrincipalFindFirst.mockResolvedValue({
      id: 'principal_eve',
      role: 'user',
      displayName: 'Eve',
      avatarUrl: null,
    })

    await postIdentify({ ssoToken: 'jwt' })

    expect(principalProfileWrites()).toEqual([
      { displayName: 'Eve', avatarUrl: 'https://cdn.acme.test/eve-old.jpg' },
    ])
  })

  it('removes the photo when a verified token says there is none', async () => {
    mockVerifyJWT.mockReturnValue({
      sub: 'sub_eve',
      email: 'eve@acme.com',
      name: 'Eve',
      avatarUrl: null,
    })
    mockUserFindFirst.mockResolvedValueOnce(existingUser())
    mockPrincipalFindFirst.mockResolvedValue({
      id: 'principal_eve',
      role: 'user',
      displayName: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })

    await postIdentify({ ssoToken: 'jwt' })

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ image: null }))
    expect(principalProfileWrites()).toEqual([{ displayName: 'Eve', avatarUrl: null }])
  })

  it('writes nothing when the principal already matches', async () => {
    mockVerifyJWT.mockReturnValue({
      sub: 'sub_eve',
      email: 'eve@acme.com',
      name: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })
    mockUserFindFirst.mockResolvedValueOnce(existingUser())
    mockPrincipalFindFirst.mockResolvedValue({
      id: 'principal_eve',
      role: 'user',
      displayName: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })

    await postIdentify({ ssoToken: 'jwt' })

    expect(principalProfileWrites()).toEqual([])
  })

  it('keeps the photo when the claim is simply absent', async () => {
    mockVerifyJWT.mockReturnValue({ sub: 'sub_eve', email: 'eve@acme.com', name: 'Eve' })
    mockUserFindFirst.mockResolvedValueOnce(existingUser())
    mockPrincipalFindFirst.mockResolvedValue({
      id: 'principal_eve',
      role: 'user',
      displayName: 'Eve',
      avatarUrl: 'https://cdn.acme.test/eve-old.jpg',
    })

    await postIdentify({ ssoToken: 'jwt' })

    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({ image: null }))
    expect(principalProfileWrites()).toEqual([])
  })
})
