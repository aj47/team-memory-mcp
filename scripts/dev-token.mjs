#!/usr/bin/env node
// Gets an access token for the MCP server the way an MCP client would, so you
// can test with curl: discover AuthKit from the server's metadata, register a
// client (Dynamic Client Registration), sign in in the browser, and exchange
// the code with PKCE. The token is saved to .token.local-<label>.
//
// Usage: node scripts/dev-token.mjs <mcp url> [label]

import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const [mcpUrl, label = 'default'] = process.argv.slice(2)
if (!mcpUrl) {
  console.error('Usage: node scripts/dev-token.mjs <mcp url> [label]')
  process.exit(1)
}

const PORT = 8976
const redirectUri = `http://127.0.0.1:${PORT}/callback`
const b64url = (buf) => buf.toString('base64url')
const getJson = async (url, init) => {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${res.status} ${await res.text()}`)
  return res.json()
}

// 1. Discovery: the MCP server names its authorization server.
const origin = new URL(mcpUrl).origin
const resourceMeta = await getJson(`${origin}/.well-known/oauth-protected-resource`)
const authServer = resourceMeta.authorization_servers[0]
const asMeta = await getJson(`${authServer}/.well-known/oauth-authorization-server`)

// 2. Register a public client.
const client = await getJson(asMeta.registration_endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'team-memory-mcp dev-token script',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
})

// 3. Authorization code with PKCE, bound to this MCP server as the resource.
const verifier = b64url(randomBytes(32))
const challenge = b64url(createHash('sha256').update(verifier).digest())
const state = b64url(randomBytes(16))
const authorizeUrl = new URL(asMeta.authorization_endpoint)
authorizeUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: client.client_id,
  redirect_uri: redirectUri,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state,
  resource: resourceMeta.resource,
  scope: 'openid profile email',
}).toString()

console.log(`Sign in as "${label}" here:\n\n${authorizeUrl}\n`)

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirectUri)
    if (url.pathname !== '/callback') return res.writeHead(404).end()
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Signed in. You can close this tab.')
    server.close()
    if (url.searchParams.get('state') !== state) return reject(new Error('State mismatch'))
    const error = url.searchParams.get('error')
    if (error) return reject(new Error(`${error}: ${url.searchParams.get('error_description') ?? ''}`))
    resolve(url.searchParams.get('code'))
  }).listen(PORT, '127.0.0.1')
})

// 4. Exchange the code for tokens.
const tokens = await getJson(asMeta.token_endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: verifier,
    resource: resourceMeta.resource,
  }),
})

const claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString())
writeFileSync(`.token.local-${label}`, tokens.access_token, { mode: 0o600 })
console.log(`Saved .token.local-${label}`)
console.log({ sub: claims.sub, org_id: claims.org_id, aud: claims.aud, expires: new Date(claims.exp * 1000).toISOString() })
