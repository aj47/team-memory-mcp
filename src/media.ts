// Serves the demo video and poster from R2 with Range support, which Safari needs
// to play and seek an MP4. Only used by /demo; the MCP server doesn't depend on it.

export async function serveMedia(request: Request, bucket: R2Bucket, key: string): Promise<Response> {
  const object = await bucket.get(key, { range: request.headers, onlyIf: request.headers })
  if (!object) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=3600')
  if (!('body' in object)) return new Response(null, { status: 304, headers })

  const range = object.range as { offset?: number; length?: number } | undefined
  if (request.headers.has('range') && range) {
    const offset = range.offset ?? 0
    const length = range.length ?? object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { headers })
}
