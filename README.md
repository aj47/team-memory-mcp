# Team Memory MCP

A shared-memory MCP server that's ready for enterprise customers: people sign in through
[WorkOS AuthKit](https://workos.com/docs/authkit/mcp) (including their company's SSO), every
note is walled off by organization, and someone removed from the organization loses access on
their agent's next call. It runs on Cloudflare Workers with D1.

```
remember("Our staging database is db-staging-2")   → saved to your organization's memory
recall("staging database")                          → only your organization's notes
forget("note_…")                                    → only the author can delete a note
```

## The three questions it answers

| An enterprise buyer asks | How this server answers | Where |
| --- | --- | --- |
| Can our people sign in with our company login? | AuthKit is the server's OAuth authorization server. MCP clients discover it from `/.well-known/oauth-protected-resource`, and AuthKit routes company emails to the company's identity provider. | `src/index.ts`, WorkOS dashboard |
| Is our data separate from other customers? | The organization comes from the verified token's `org_id`, never from tool input, and every query is scoped by it. | `src/auth.ts`, `src/store.ts` |
| Does access end when someone leaves? | A token stays valid until it expires, so each request also checks the user is still an active member of that organization (cached 60 s). | `src/membership.ts` |

## Status

| Check | Unit tests | Deployed (Workers) |
| --- | --- | --- |
| 401 challenge and resource metadata | yes | yes (`test/no-token.sh`) |
| Token checks: signature, issuer, audience, `org_id` | yes (locally signed JWTs) | yes (real AuthKit tokens) |
| Isolation: Acme's notes invisible to Globex, even by note id | yes | yes |
| Offboarding: deactivated member refused while their token is still valid | yes | yes (`403 not_a_member` once the 60 s cache lapsed) |
| Company SSO through the WorkOS Test Identity Provider | n/a | yes (`example.com` user joined Test Organization automatically) |
| Claude Code as the client | n/a | **not yet run** (tested with `scripts/dev-token.mjs`, which follows the same discovery and DCR flow) |

## Run it

You need a [WorkOS](https://dashboard.workos.com) account (staging is free), a Cloudflare
account, and Node 20+.

1. **Install and create the database.**
   ```sh
   npm install
   npx wrangler d1 create team-memory-mcp     # put the database_id in wrangler.jsonc
   npx wrangler d1 migrations apply team-memory-mcp --remote
   ```
2. **Point it at your AuthKit.** Set `AUTHKIT_DOMAIN` in `wrangler.jsonc` (WorkOS dashboard →
   Domains, or `workos project list`). Then add your WorkOS secret API key as a Worker secret:
   ```sh
   npx wrangler secret put WORKOS_API_KEY
   ```
3. **Deploy.** `npm run deploy` prints your URL; the MCP endpoint is `<url>/mcp`.
4. **Configure WorkOS** (dashboard → Connect → Configuration):
   - **MCP Auth → Manage:** enable Client ID Metadata Document, and Dynamic Client
     Registration for older clients.
   - **MCP resource indicators:** add `<url>/mcp` and set it as the default.
   - Create organizations and users (dashboard, or `workos organization create Acme`).
     For SSO, the staging **Test Organization** already routes any `example.com` email to the
     Test Identity Provider (dashboard → Test SSO).
5. **Connect a client.** In Claude Code:
   ```sh
   claude mcp add --transport http team-memory <url>/mcp
   ```
   Run `/mcp`, choose team-memory, sign in, and ask it to remember something.

### Test without an MCP client

```sh
sh test/no-token.sh <url>                                    # the 401 challenge
node scripts/dev-token.mjs <url>/mcp alice                   # sign in; saves .token.local-alice
node scripts/call.mjs <url>/mcp alice remember '{"text":"Deploys freeze on Fridays."}'
node scripts/call.mjs <url>/mcp alice recall '{"query":"deploys"}'
npm test                                                     # 15 unit tests
```

`dev-token.mjs` does what an MCP client does: reads the server's metadata, registers with
AuthKit (DCR), signs in with PKCE, and exchanges the code. Add `&prompt=login` to the printed URL
to sign in as someone else in the same browser.

## Where secrets live

- `WORKOS_API_KEY` is a Worker secret. It is used only for the membership lookup and never
  reaches a client.
- The server stores no user tokens. It verifies each request's bearer token against AuthKit's
  public keys (`/oauth2/jwks`).
- `.dev.vars`, `.token.local-*` and `.demo-users.local.json` are git-ignored.

## With more time

- **Roles:** let admins `forget` any note. Connect tokens carry no permissions, so add
  `organization_membership.roles` to a JWT template or look roles up on the server.
- **Audit Logs:** record who stored and read what, and stream it to the customer's SIEM.
- **Directory Sync:** offboard automatically when IT removes someone from Okta or Entra.
- **Search:** full-text or vector search instead of word matching over the latest 500 notes.
- **Revocation:** check whether removing a member also revokes their MCP refresh token.
