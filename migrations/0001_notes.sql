-- One table for every organization's notes; every query filters on org_id.
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX notes_by_org ON notes (org_id, created_at DESC);
