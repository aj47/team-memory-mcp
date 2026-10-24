// The notes. Every read and write takes the organization as its first argument,
// and the server only ever passes the one from the verified token.

export interface Note {
  id: string
  text: string
  tags: string[]
  authorId: string
  createdAt: string
}

export type ForgetResult = 'deleted' | 'not_found' | 'not_author'

export interface NoteStore {
  add(orgId: string, note: Note): Promise<void>
  list(orgId: string): Promise<Note[]>
  get(orgId: string, id: string): Promise<Note | null>
  delete(orgId: string, id: string): Promise<void>
}

export function newNote(authorId: string, text: string, tags: string[] = []): Note {
  return {
    id: `note_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
    text,
    tags,
    authorId,
    createdAt: new Date().toISOString(),
  }
}

/** Notes matching any word of the query, best match first; newest first when empty. */
export function rank(notes: Note[], query: string, limit = 10): Note[] {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 1)
  const byDate = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (words.length === 0) return byDate.slice(0, limit)

  return byDate
    .map((note) => {
      const hay = `${note.text} ${note.tags.join(' ')}`.toLowerCase()
      return { note, score: words.filter((w) => hay.includes(w)).length }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.note)
}

/** Only the note's author may forget it. */
export async function forget(store: NoteStore, orgId: string, userId: string, id: string): Promise<ForgetResult> {
  const note = await store.get(orgId, id)
  if (!note) return 'not_found'
  if (note.authorId !== userId) return 'not_author'
  await store.delete(orgId, id)
  return 'deleted'
}

/** Cloudflare D1. Every query is scoped with `WHERE org_id = ?`. */
export class D1NoteStore implements NoteStore {
  constructor(private db: D1Database) {}

  async add(orgId: string, n: Note) {
    await this.db
      .prepare('INSERT INTO notes (id, org_id, author_id, text, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(n.id, orgId, n.authorId, n.text, JSON.stringify(n.tags), n.createdAt)
      .run()
  }

  async list(orgId: string) {
    const { results } = await this.db
      .prepare('SELECT * FROM notes WHERE org_id = ? ORDER BY created_at DESC LIMIT 500')
      .bind(orgId)
      .all<NoteRow>()
    return results.map(fromRow)
  }

  async get(orgId: string, id: string) {
    const row = await this.db.prepare('SELECT * FROM notes WHERE org_id = ? AND id = ?').bind(orgId, id).first<NoteRow>()
    return row ? fromRow(row) : null
  }

  async delete(orgId: string, id: string) {
    await this.db.prepare('DELETE FROM notes WHERE org_id = ? AND id = ?').bind(orgId, id).run()
  }
}

interface NoteRow {
  id: string
  org_id: string
  author_id: string
  text: string
  tags: string
  created_at: string
}

function fromRow(r: NoteRow): Note {
  return { id: r.id, text: r.text, tags: JSON.parse(r.tags) as string[], authorId: r.author_id, createdAt: r.created_at }
}

/** In memory, for tests. */
export class MemoryNoteStore implements NoteStore {
  private notes = new Map<string, Note[]>()

  async add(orgId: string, note: Note) {
    this.notes.set(orgId, [...(this.notes.get(orgId) ?? []), note])
  }
  async list(orgId: string) {
    return [...(this.notes.get(orgId) ?? [])]
  }
  async get(orgId: string, id: string) {
    return this.notes.get(orgId)?.find((n) => n.id === id) ?? null
  }
  async delete(orgId: string, id: string) {
    this.notes.set(orgId, (this.notes.get(orgId) ?? []).filter((n) => n.id !== id))
  }
}
