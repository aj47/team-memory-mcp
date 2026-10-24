// Offboarding: a token stays valid until it expires, even after the person has
// left. So every request also asks WorkOS whether the user is still an active
// member of the organization in their token, cached briefly per user and org.

export type MembershipCheck = (userId: string, orgId: string) => Promise<boolean>

export interface MembershipOptions {
  /** The WorkOS secret API key (a Worker secret, never sent to clients). */
  apiKey: string
  /** How long an answer is reused. This is the longest a removed member keeps access. */
  ttlSeconds?: number
  fetchImpl?: typeof fetch
  now?: () => number
}

export function createMembershipCheck({
  apiKey,
  ttlSeconds = 60,
  fetchImpl = fetch,
  now = Date.now,
}: MembershipOptions): MembershipCheck {
  const cache = new Map<string, { active: boolean; expires: number }>()

  return async (userId, orgId) => {
    const key = `${userId}:${orgId}`
    const hit = cache.get(key)
    if (hit && hit.expires > now()) return hit.active

    // Lists active memberships only, unless `statuses` says otherwise.
    const url = new URL('https://api.workos.com/user_management/organization_memberships')
    url.searchParams.set('user_id', userId)
    url.searchParams.set('organization_id', orgId)
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) throw new Error(`WorkOS membership lookup failed (${res.status})`)

    const body = (await res.json()) as { data: { status: string }[] }
    const active = body.data.some((m) => m.status === 'active')
    cache.set(key, { active, expires: now() + ttlSeconds * 1000 })
    return active
  }
}
