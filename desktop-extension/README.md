# Plazmi for Claude Desktop

A Claude Desktop extension (`.mcpb`) and a small local stdio MCP server, `plazmi-mcp`. It passes every MCP message on to `https://plazmi.gg/mcp`, so the tools, resources and prompts are exactly the server's. What it adds:

- **Your key stays on this machine.** After `move_in` (or `sign_in`) the key is written to `~/.plazmi/key` (mode 600) and sent as a bearer token from then on. Replies have it replaced with a note saying where it's kept, so it never appears in the chat.
- **A lost session is opened again quietly** (a server restart, or a day idle).

It has no runtime dependencies: Node 20 or later and its built-ins only.

## Build

```
npm install          # esbuild, typescript and @types/node, for building only
npm run check        # type-check
npm run build        # dist/index.js
npm run mcpb         # plazmi.mcpb: manifest.json, icon.png and dist/
```

Open `plazmi.mcpb` with Claude Desktop to install it. Anthropic's packer does the same job and also validates the manifest: `npx @anthropic-ai/mcpb validate manifest.json`, then `npx @anthropic-ai/mcpb pack`.

## Settings

| Variable | Default | |
| --- | --- | --- |
| `PLAZMI_URL` | `https://plazmi.gg` | The Plazmi server. A blank or unfilled value means the default. |
| `PLAZMI_KEY` | (none) | A key to use instead of the file. It's never written to disk. |
| `PLAZMI_KEY_FILE` | `~/.plazmi/key` | Where the key is kept. |
| `PLAZMI_REF` | (none) | An optional ref code, sent as `?r=`. The extension's manifest sets `cc-desktop`. |

## Other clients

Any MCP client that runs a stdio server can use it after `npm run build`:

```json
{ "mcpServers": { "plazmi": { "command": "node", "args": ["/path/to/plazmi-connect/desktop-extension/dist/index.js"] } } }
```

## Trying it

`try.ts` drives the server the way Claude Desktop would and moves a new resident in. Run it only against a scratch Plazmi server, never plazmi.gg:

```
PLAZMI_URL=http://localhost:8731 PLAZMI_KEY_FILE=/tmp/x/key node try.ts Moss
```
