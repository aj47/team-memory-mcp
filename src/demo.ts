// The review page for the demo: the recorded walkthrough and its companion post.
// The video and poster are served from R2 by media.ts.

const REPO = 'https://github.com/aj47/team-memory-mcp'

export function demoPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team Memory MCP: demo and write-up</title>
<meta property="og:title" content="Your MCP server runs on API keys. Enterprises won't.">
<meta property="og:description" content="Team Memory MCP: an example MCP server secured with WorkOS AuthKit. Demo video and companion post.">
<meta property="og:image" content="/media/poster.jpg">
<style>
  :root { color-scheme: dark; --bg: #0b0d12; --panel: #12151c; --edge: #262b36; --text: #f2f4f8; --dim: #9aa2b1; --accent: #6366f1; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 18px/1.65 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 56px 24px 72px; }
  .kicker { font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--dim); margin: 0 0 10px; }
  h1 { font-size: 40px; line-height: 1.15; margin: 0 0 24px; letter-spacing: -0.5px; }
  video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; border: 1px solid var(--edge); border-radius: 8px; }
  .links { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 0; }
  .links a { font-size: 15px; text-decoration: none; color: var(--text); background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 8px 14px; }
  .links a:hover { border-color: var(--accent); }
  article { max-width: 720px; margin: 64px auto 0; }
  article h2 { font-size: 30px; line-height: 1.2; margin: 0 0 20px; letter-spacing: -0.3px; }
  article p { color: #d4d8e0; margin: 0 0 18px; }
  figure { margin: 28px 0 32px; }
  figure img { display: block; width: 100%; height: auto; border: 1px solid var(--edge); border-radius: 8px; }
  figcaption { color: var(--dim); font-size: 15px; margin-top: 10px; }
  a { color: var(--text); }
  footer { max-width: 720px; margin: 48px auto 0; color: var(--dim); font-size: 15px; border-top: 1px solid var(--edge); padding-top: 20px; }
</style>
</head>
<body>
<main>
  <p class="kicker">WorkOS Developer Relations exercise · AJ</p>
  <h1>Team Memory MCP</h1>
  <video controls preload="metadata" playsinline poster="/media/poster.jpg">
    <source src="/media/team-memory-demo.mp4" type="video/mp4">
  </video>
  <div class="links">
    <a href="${REPO}">Source and README</a>
    <a href="${REPO}#with-more-time">With more time</a>
    <a href="/">Live server</a>
    <a href="/media/team-memory-demo.mp4" download>Download video (2:33)</a>
  </div>

  <article>
    <p class="kicker">Companion post</p>
    <h2>Your MCP server runs on API keys. Enterprises won't.</h2>
    <p>I built Team Memory MCP, an example MCP server that lets a team share what their agents learn: Alice's agent remembers where the staging database lives, and Bob's agent recalls it the next day. The demo video walks through it in Claude Code, from first sign-in to offboarding.</p>
    <p>A startup shipping this would hand out API keys from its own dashboard, and each user would paste one into a config file. That works until a company wants it for five hundred engineers. Their security team sees a long-lived secret the agent can read, no company login, and a key that keeps working after someone leaves.</p>
    <p>So AuthKit is the server's OAuth authorization server, and nobody pastes a key. Claude Code finds AuthKit from the server's metadata, registers itself, and opens a normal sign-in, through the company's SSO if it has one.</p>
    <p>Every request then passes three checks. The token must be valid for this server. The user must still be an active member of their organization, which the server asks WorkOS about with a 60-second cache. And every query is scoped to the organization in the token, never to anything the agent sends. The lesson: a valid token doesn't prove someone still works there.</p>
    <figure>
      <img src="/media/three-checks.jpg" width="1392" height="860" loading="lazy" alt="A recall call carrying a Bearer token passes three checks: verify the token against AuthKit's public keys, confirm membership with the WorkOS API (cached 60 seconds), and query D1 only where org_id equals the token's org_id.">
      <figcaption>Every call: the token, the membership, then a query scoped to the token's organization.</figcaption>
    </figure>
    <p>Clone the repo, add your WorkOS keys, and connect it to Claude Code. The README covers setup and what comes next: teams with Fine-Grained Authorization, roles, audit logs, and Directory Sync.</p>
    <p><a href="${REPO}">github.com/aj47/team-memory-mcp</a></p>
  </article>

  <footer>Built on Cloudflare Workers and D1 · Sign-in by <a href="https://workos.com/docs/authkit/mcp">WorkOS AuthKit</a></footer>
</main>
</body>
</html>`
}
