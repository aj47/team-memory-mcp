#!/bin/sh
# Calls the server without a token, then with a bad one, and prints each challenge.
# Usage: sh test/no-token.sh https://team-memory-mcp.<you>.workers.dev
set -eu
BASE="${1:?usage: sh test/no-token.sh <base url>}"

post() {
  curl -s -o /dev/null -D - -X POST "$BASE/mcp" "$@" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE '^HTTP|^www-authenticate'
}

echo "POST $BASE/mcp without a token:"
post

echo
echo "POST $BASE/mcp with a bad token:"
post -H 'Authorization: Bearer abc'

echo
echo "GET $BASE/.well-known/oauth-protected-resource:"
curl -s "$BASE/.well-known/oauth-protected-resource"
echo
