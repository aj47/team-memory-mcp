#!/usr/bin/env node
// Calls one MCP tool with a saved token, for testing without an MCP client.
// Usage: node scripts/call.mjs <mcp url> <label> <tool> ['{"json":"args"}']

import { readFileSync } from 'node:fs'

const [mcpUrl, label, tool, args = '{}'] = process.argv.slice(2)
if (!tool) {
  console.error(`Usage: node scripts/call.mjs <mcp url> <label> <tool> ['{"json":"args"}']`)
  process.exit(1)
}

const token = readFileSync(`.token.local-${label}`, 'utf8').trim()
const res = await fetch(mcpUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: JSON.parse(args) } }),
})

const body = await res.json()
if (!res.ok) {
  console.log(`${res.status}:`, body)
  process.exit(1)
}
console.log(body.result.content.map((c) => c.text).join('\n'))
