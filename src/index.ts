// The Worker: OAuth discovery for MCP clients, then every /mcp request passes
// three checks before a tool runs: a valid AuthKit token, an organization in it,
// and a current membership in that organization.

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { AuthError, bearerToken, createTokenVerifier, type TokenVerifier } from './auth.js'
import { homePage } from './home.js'
import { buildServer } from './mcp.js'
import { createMembershipCheck, type MembershipCheck } from './membership.js'
import { D1NoteStore, type NoteStore } from './store.js'

export interface Env {
  DB: D1Database
  /** Your AuthKit domain, e.g. `example-123.authkit.app`. */
  AUTHKIT_DOMAIN: string
  /** WorkOS secret API key, for the membership check. Set with `wrangler secret put`. */
  WORKOS_API_KEY: string
  /** The MCP endpoint URL registered in WorkOS; defaults to `<origin>/mcp`. */
  MCP_RESOURCE?: string
  /** How long a membership answer is reused (default 60). */
  MEMBERSHIP_CACHE_SECONDS?: string
}

export interface Deps {
  /** The MCP endpoint URL, which is also the token audience. */
  resource: string
  /** `https://<AuthKit domain>`, the authorization server. */
  authServer: string
  verify: TokenVerifier
  isMember: MembershipCheck
  store: NoteStore
  fetchImpl?: typeof fetch
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))

  if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
    return cors(
      Response.json({
        resource: deps.resource,
        authorization_servers: [deps.authServer],
        bearer_methods_supported: ['header'],
        resource_name: 'Team Memory',
      }),
    )
  }

  // For clients that skip protected-resource metadata: AuthKit stays the source of truth.
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    const upstream = await (deps.fetchImpl ?? fetch)(`${deps.authServer}/.well-known/oauth-authorization-server`)
    return cors(Response.json(await upstream.json()))
  }

  if (url.pathname === '/mcp') return cors(await handleMcp(request, url, deps))

  if (url.pathname === '/') {
    return new Response(homePage(deps.resource), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return new Response('Not found', { status: 404 })
}

async function handleMcp(request: Request, url: URL, deps: Deps): Promise<Response> {
  const challenge = [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
  ].join(', ')

  const token = bearerToken(request)
  if (!token) return refuse(new AuthError(401, 'unauthorized', 'Sign in to use team memory.'), challenge)

  try {
    // 1. Who is calling, and under which organization.
    const caller = await deps.verify(token)

    // 2. Are they still in that organization? Fail closed if WorkOS can't say.
    let member: boolean
    try {
      member = await deps.isMember(caller.userId, caller.orgId)
    } catch {
      throw new AuthError(503, 'membership_unavailable', 'Couldn’t confirm your organization membership. Try again.')
    }
    if (!member) throw new AuthError(403, 'not_a_member', 'Access ended: you’re no longer an active member of this organization.')

    // 3. Tools for this caller only.
    const server = buildServer(caller, deps.store)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    return await transport.handleRequest(request, {
      authInfo: {
        token,
        clientId: caller.clientId,
        scopes: caller.scopes,
        expiresAt: caller.expiresAt,
        resource: new URL(deps.resource),
        extra: { userId: caller.userId, orgId: caller.orgId },
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return refuse(err, challenge)
    throw err
  }
}

function refuse(err: AuthError, challenge: string): Response {
  const headers: Record<string, string> = {}
  if (err.status === 401) headers['WWW-Authenticate'] = challenge
  return Response.json({ error: err.code, message: err.message }, { status: err.status, headers })
}

function cors(res: Response): Response {
  const out = new Response(res.body, res)
  out.headers.set('Access-Control-Allow-Origin', '*')
  out.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version')
  out.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  out.headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id')
  return out
}

// One verifier and membership cache per Worker isolate, reused across requests.
let cached: { key: string; verify: TokenVerifier; isMember: MembershipCheck } | undefined

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authServer = `https://${env.AUTHKIT_DOMAIN}`
    const resource = env.MCP_RESOURCE ?? `${new URL(request.url).origin}/mcp`
    const key = `${authServer}|${resource}|${env.MEMBERSHIP_CACHE_SECONDS ?? ''}`
    if (cached?.key !== key) {
      cached = {
        key,
        verify: createTokenVerifier({ issuer: authServer, audience: resource }),
        isMember: createMembershipCheck({
          apiKey: env.WORKOS_API_KEY,
          ttlSeconds: Number(env.MEMBERSHIP_CACHE_SECONDS ?? 60),
        }),
      }
    }
    return handle(request, { resource, authServer, ...cached, store: new D1NoteStore(env.DB) })
  },
} satisfies ExportedHandler<Env>
