// The tools. Each server instance is built for one verified caller, so the
// organization is fixed before any tool runs and no tool takes it as input.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Caller } from './auth.js'
import { forget, newNote, rank, type Note, type NoteStore } from './store.js'

export function buildServer(caller: Caller, store: NoteStore): McpServer {
  const server = new McpServer({ name: 'team-memory', version: '0.1.0' })

  server.registerTool(
    'remember',
    {
      title: 'Remember',
      description: "Save a note to your organization's shared memory. Everyone in your organization can recall it.",
      inputSchema: {
        text: z.string().min(1).max(2000).describe('The fact or decision to remember.'),
        tags: z.array(z.string().min(1).max(40)).max(10).optional().describe('Optional topic tags.'),
      },
    },
    async ({ text, tags }) => {
      const note = newNote(caller.userId, text, tags)
      await store.add(caller.orgId, note)
      return reply(`Saved ${note.id} to your organization's memory.`)
    },
  )

  server.registerTool(
    'recall',
    {
      title: 'Recall',
      description: "Search your organization's shared memory. Leave the query empty for the latest notes.",
      inputSchema: {
        query: z.string().max(200).optional().describe('Words to look for.'),
        limit: z.number().int().min(1).max(25).optional().describe('Most notes to return (default 10).'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      const notes = rank(await store.list(caller.orgId), query ?? '', limit)
      if (notes.length === 0) return reply('Nothing in your organization’s memory matches that.')
      return reply(notes.map(describe).join('\n'))
    },
  )

  server.registerTool(
    'forget',
    {
      title: 'Forget',
      description: 'Delete a note you wrote, by its id.',
      inputSchema: { id: z.string().min(1).describe('The note id, e.g. note_1a2b3c4d5e6f7a8b.') },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      const result = await forget(store, caller.orgId, caller.userId, id)
      if (result === 'deleted') return reply(`Forgot ${id}.`)
      if (result === 'not_author') return reply(`Only the author of ${id} can forget it.`, true)
      return reply(`No note ${id} in your organization’s memory.`, true)
    },
  )

  return server
}

function describe(n: Note): string {
  const tags = n.tags.length ? ` [${n.tags.join(', ')}]` : ''
  return `- ${n.id}: ${n.text}${tags} (by ${n.authorId}, ${n.createdAt.slice(0, 10)})`
}

function reply(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], isError }
}
