#!/bin/sh
# Calls the deployed server without a token and prints the sign-in challenge.
# Usage: sh test/no-token.sh https://team-memory-mcp.<you>.workers.dev
set -eu
BASE="${1:?usage: sh test/no-token.sh <base url>}"

echo "POST $BASE/mcp without a token:"
curl -s -o /dev/null -D - -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE '^HTTP|^www-authenticate'

echo
echo "GET $BASE/.well-known/oauth-protected-resource:"
curl -s "$BASE/.well-known/oauth-protected-resource"
echo
