// The page a person sees if they open the server in a browser: what it is, and
// the one command that connects it. Agents never load this; they go to /mcp.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function homePage(resource: string): string {
  const cmd = `claude mcp add --transport http team-memory ${esc(resource)}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team Memory MCP</title>
<style>
  :root { color-scheme: dark; --bg: #0b0d12; --panel: #12151c; --edge: #262b36; --text: #f2f4f8; --dim: #9aa2b1; --accent: #6366f1; --green: #0ca30c; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 72px 24px; }
  h1 { font-size: 40px; line-height: 1.15; margin: 0 0 12px; letter-spacing: -0.5px; }
  p { color: var(--dim); margin: 0 0 20px; }
  h2 { font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--dim); margin: 44px 0 14px; }
  .cmd { display: flex; gap: 12px; align-items: center; background: var(--panel); border: 1px solid var(--edge); border-left: 4px solid var(--accent); border-radius: 6px; padding: 14px 16px; }
  .cmd code { flex: 1; font: 15px/1.5 ui-monospace, Menlo, monospace; overflow-wrap: anywhere; }
  button { font: inherit; font-size: 14px; color: var(--text); background: transparent; border: 1px solid var(--edge); border-radius: 4px; padding: 6px 12px; cursor: pointer; }
  button:hover { border-color: var(--accent); }
  ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  li { display: flex; gap: 14px; align-items: baseline; background: var(--panel); border: 1px solid var(--edge); border-left: 4px solid var(--green); border-radius: 6px; padding: 14px 16px; }
  li b { min-width: 22px; color: var(--green); font-family: ui-monospace, Menlo, monospace; }
  li span { color: var(--dim); }
  a { color: var(--text); }
  footer { margin-top: 44px; color: var(--dim); font-size: 15px; }
</style>
</head>
<body>
<main>
  <h1>Team Memory MCP</h1>
  <p>Shared memory for your team's AI agents. No API key to paste: you sign in with your company's login, and access ends when you leave the organization.</p>

  <h2>Connect Claude Code</h2>
  <div class="cmd"><code id="cmd">${cmd}</code><button onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent);this.textContent='Copied'">Copy</button></div>
  <p style="margin-top:12px">Then run <code>/mcp</code>, choose team-memory and Authenticate. Any MCP client that supports OAuth works the same way.</p>

  <h2>Every request passes three checks</h2>
  <ol>
    <li><b>1</b><div>A valid AuthKit token <span>· issued for this server, with an organization in it</span></div></li>
    <li><b>2</b><div>A current membership <span>· WorkOS confirms you're still in that organization</span></div></li>
    <li><b>3</b><div>Your organization's notes only <span>· taken from the token, never from the request</span></div></li>
  </ol>

  <footer><a href="/demo">Demo video and write-up</a> · Source, setup and tests: <a href="https://github.com/aj47/team-memory-mcp">github.com/aj47/team-memory-mcp</a> · Sign-in by <a href="https://workos.com/docs/authkit/mcp">WorkOS AuthKit</a></footer>
</main>
</body>
</html>`
}
