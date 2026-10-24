import { describe, expect, it } from 'vitest'
import { AUTH_SERVER, RESOURCE, mcpRequest, testServer } from './helpers.js'

describe('sign-in', () => {
  it('answers a request without a token with 401 and the metadata URL', async () => {
    const { fetch } = await testServer()
    const res = await fetch(mcpRequest('tools/list', {}))
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata="https://memory.example.com/.well-known/oauth-protected-resource"',
    )
  })

  it('points MCP clients at AuthKit', async () => {
    const { fetch } = await testServer()
    const res = await fetch(new Request('https://memory.example.com/.well-known/oauth-protected-resource'))
    expect(await res.json()).toMatchObject({ resource: RESOURCE, authorization_servers: [AUTH_SERVER] })
  })

  it('refuses a token minted for another server', async () => {
    const { fetch, authkit } = await testServer()
    const token = await authkit.token({ sub: 'user_a', org_id: 'org_acme' }, { audience: 'https://other.example.com/mcp' })
    expect((await fetch(mcpRequest('tools/list', {}, token))).status).toBe(401)
  })

  it('refuses a token from another issuer', async () => {
    const { fetch, authkit } = await testServer()
    const token = await authkit.token({ sub: 'user_a', org_id: 'org_acme' }, { issuer: 'https://evil.example.com' })
    expect((await fetch(mcpRequest('tools/list', {}, token))).status).toBe(401)
  })

  it('refuses a token with no organization', async () => {
    const { fetch, authkit } = await testServer()
    const token = await authkit.token({ sub: 'user_a' })
    const res = await fetch(mcpRequest('tools/list', {}, token))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'no_organization' })
  })

  it('lists the three tools for a signed-in member', async () => {
    const { fetch, signIn } = await testServer()
    const res = await fetch(mcpRequest('tools/list', {}, await signIn('user_a', 'org_acme')))
    const body = (await res.json()) as { result: { tools: { name: string }[] } }
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(['forget', 'recall', 'remember'])
  })
})
