import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { createTokenVerifier } from '../src/auth.js'
import { handle, type Deps } from '../src/index.js'
import { MemoryNoteStore } from '../src/store.js'

export const AUTH_SERVER = 'https://example-123.authkit.app'
export const RESOURCE = 'https://memory.example.com/mcp'

/** A fake AuthKit: a signing key, its JWKS, and a way to mint Connect-style tokens. */
export async function fakeAuthKit() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' }
  const jwks = createLocalJWKSet({ keys: [jwk] })

  const token = (claims: Record<string, unknown>, opts: { audience?: string; issuer?: string } = {}) =>
    new SignJWT({ client_id: 'client_test', scope: '', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(opts.issuer ?? AUTH_SERVER)
      .setAudience(opts.audience ?? RESOURCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)

  return { jwks, token }
}

export async function testServer(overrides: Partial<Deps> = {}) {
  const authkit = await fakeAuthKit()
  const store = new MemoryNoteStore()
  const members = new Set<string>()
  const deps: Deps = {
    resource: RESOURCE,
    authServer: AUTH_SERVER,
    verify: createTokenVerifier({ issuer: AUTH_SERVER, audience: RESOURCE, jwks: authkit.jwks }),
    isMember: async (userId, orgId) => members.has(`${userId}:${orgId}`),
    store,
    ...overrides,
  }

  /** Sign in a user under an organization and return their bearer token. */
  const signIn = async (userId: string, orgId: string) => {
    members.add(`${userId}:${orgId}`)
    return authkit.token({ sub: userId, org_id: orgId })
  }
  const offboard = (userId: string, orgId: string) => members.delete(`${userId}:${orgId}`)

  return { deps, store, authkit, signIn, offboard, fetch: (req: Request) => handle(req, deps) }
}

let rpcId = 0

/** POST one JSON-RPC message to /mcp, the way a streamable-HTTP MCP client does. */
export function mcpRequest(method: string, params: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'Mcp-Protocol-Version': '2025-06-18',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request(RESOURCE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
}

/** Call a tool and return its text and error flag. */
export async function callTool(fetch: (r: Request) => Promise<Response>, token: string, name: string, args: unknown) {
  const res = await fetch(mcpRequest('tools/call', { name, arguments: args }, token))
  if (res.status !== 200) throw new Error(`tools/call ${name} returned ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } }
  return { text: body.result.content.map((c) => c.text).join('\n'), isError: body.result.isError ?? false }
}
