import { describe, expect, it } from 'vitest'
import { callTool, testServer } from './helpers.js'

describe('organization isolation', () => {
  it('shares notes inside an organization and hides them from others', async () => {
    const { fetch, signIn } = await testServer()
    const alice = await signIn('user_alice', 'org_acme')
    const bob = await signIn('user_bob', 'org_acme')
    const gina = await signIn('user_gina', 'org_globex')

    await callTool(fetch, alice, 'remember', { text: 'The staging database is db-staging-2.', tags: ['infra'] })

    expect((await callTool(fetch, bob, 'recall', { query: 'staging database' })).text).toContain('db-staging-2')
    expect((await callTool(fetch, gina, 'recall', { query: 'staging database' })).text).toContain('Nothing')
    expect((await callTool(fetch, gina, 'recall', {})).text).toContain('Nothing')
  })

  it('ignores an organization smuggled into tool input', async () => {
    const { fetch, signIn } = await testServer()
    const alice = await signIn('user_alice', 'org_acme')
    const gina = await signIn('user_gina', 'org_globex')
    await callTool(fetch, alice, 'remember', { text: 'Acme launch is on Friday.' })

    const { text } = await callTool(fetch, gina, 'recall', { query: 'launch', orgId: 'org_acme', org_id: 'org_acme' })
    expect(text).toContain('Nothing')
  })

  it('cannot forget another organization’s note, even by id', async () => {
    const { fetch, signIn, store } = await testServer()
    const alice = await signIn('user_alice', 'org_acme')
    const gina = await signIn('user_gina', 'org_globex')
    await callTool(fetch, alice, 'remember', { text: 'Acme secret.' })
    const [note] = await store.list('org_acme')

    const result = await callTool(fetch, gina, 'forget', { id: note!.id })
    expect(result.isError).toBe(true)
    expect(await store.list('org_acme')).toHaveLength(1)
  })

  it('lets only the author forget a note', async () => {
    const { fetch, signIn, store } = await testServer()
    const alice = await signIn('user_alice', 'org_acme')
    const bob = await signIn('user_bob', 'org_acme')
    await callTool(fetch, alice, 'remember', { text: 'Alice’s note.' })
    const [note] = await store.list('org_acme')

    expect((await callTool(fetch, bob, 'forget', { id: note!.id })).text).toContain('Only the author')
    expect((await callTool(fetch, alice, 'forget', { id: note!.id })).text).toContain('Forgot')
    expect(await store.list('org_acme')).toHaveLength(0)
  })
})
