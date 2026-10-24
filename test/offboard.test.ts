import { describe, expect, it } from 'vitest'
import { createMembershipCheck } from '../src/membership.js'
import { callTool, mcpRequest, testServer } from './helpers.js'

describe('offboarding', () => {
  it('refuses a removed member whose token is still valid', async () => {
    const { fetch, signIn, offboard } = await testServer()
    const alice = await signIn('user_alice', 'org_acme')
    await callTool(fetch, alice, 'remember', { text: 'Deploys freeze on Fridays.' })

    offboard('user_alice', 'org_acme')

    const res = await fetch(mcpRequest('tools/call', { name: 'recall', arguments: {} }, alice))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'not_a_member' })
  })

  it('fails closed when membership can’t be checked', async () => {
    const { fetch, signIn } = await testServer({
      isMember: async () => {
        throw new Error('WorkOS unreachable')
      },
    })
    const res = await fetch(mcpRequest('tools/list', {}, await signIn('user_alice', 'org_acme')))
    expect(res.status).toBe(503)
  })
})

describe('membership check', () => {
  const membershipsApi = (statuses: string[]) => {
    const calls: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input))
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sk_test')
      return Response.json({ data: statuses.map((status) => ({ status })) })
    }) as typeof fetch
    return { calls, fetchImpl }
  }

  it('asks WorkOS for this user in this organization', async () => {
    const api = membershipsApi(['active'])
    const isMember = createMembershipCheck({ apiKey: 'sk_test', fetchImpl: api.fetchImpl })
    expect(await isMember('user_alice', 'org_acme')).toBe(true)

    const url = new URL(api.calls[0]!)
    expect(url.pathname).toBe('/user_management/organization_memberships')
    expect(url.searchParams.get('user_id')).toBe('user_alice')
    expect(url.searchParams.get('organization_id')).toBe('org_acme')
  })

  it('treats no active membership as not a member', async () => {
    const api = membershipsApi(['inactive'])
    const isMember = createMembershipCheck({ apiKey: 'sk_test', fetchImpl: api.fetchImpl })
    expect(await isMember('user_alice', 'org_acme')).toBe(false)
  })

  it('reuses an answer for the cache period, then asks again', async () => {
    let now = 0
    const api = membershipsApi(['active'])
    const isMember = createMembershipCheck({ apiKey: 'sk_test', ttlSeconds: 60, fetchImpl: api.fetchImpl, now: () => now })

    await isMember('user_alice', 'org_acme')
    now = 59_000
    await isMember('user_alice', 'org_acme')
    expect(api.calls).toHaveLength(1)

    now = 61_000
    await isMember('user_alice', 'org_acme')
    expect(api.calls).toHaveLength(2)
  })
})
