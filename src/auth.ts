// Who is calling: verify the AuthKit access token an MCP client sends, and read
// the user and the organization they signed in under.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

/** The verified caller. `orgId` comes from the token, never from tool input. */
export interface Caller {
  userId: string
  orgId: string
  clientId: string
  scopes: string[]
  expiresAt?: number
  token: string
}

/** A refused request, with the HTTP status and a message for the person. */
export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export interface VerifierOptions {
  /** `https://<your AuthKit domain>`, the token's `iss`. */
  issuer: string
  /** The MCP endpoint URL registered as a resource indicator, the token's `aud`. */
  audience: string
  /** Signing keys; defaults to AuthKit's published JWKS. Tests pass their own. */
  jwks?: JWTVerifyGetKey
}

export type TokenVerifier = (token: string) => Promise<Caller>

export function createTokenVerifier({ issuer, audience, jwks }: VerifierOptions): TokenVerifier {
  const keys = jwks ?? createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`))

  return async (token) => {
    let payload
    try {
      ;({ payload } = await jwtVerify(token, keys, { issuer, audience }))
    } catch {
      throw new AuthError(401, 'invalid_token', 'The access token is invalid or has expired.')
    }

    if (typeof payload.sub !== 'string') {
      throw new AuthError(401, 'invalid_token', 'The access token has no user.')
    }
    // Connect tokens carry the organization chosen at sign-in as `org_id`.
    if (typeof payload.org_id !== 'string') {
      throw new AuthError(
        403,
        'no_organization',
        'This token has no organization. Sign in again and choose your organization; if you’ve left it, access has ended.',
      )
    }

    return {
      userId: payload.sub,
      orgId: payload.org_id,
      clientId: typeof payload.client_id === 'string' ? payload.client_id : '',
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
      expiresAt: payload.exp,
      token,
    }
  }
}

/** The bearer token from an Authorization header, or null. */
export function bearerToken(request: Request): string | null {
  return request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null
}
