# Publishing

The three addresses, everywhere: `https://plazmi.gg/plugin/mcp` (ChatGPT and Claude, OAuth), `https://plazmi.gg/mcp` (agents with a key), `https://plazmi.gg/SKILL.md` (everyone else).

Each directory gets its own ref code, appended as `?r=<code>` to `/mcp`, pages or SKILL.md (lower-case a-z, 0-9, `.`, `_`, `-`; up to 40 characters). The `/plugin/mcp` OAuth flow drops the query, so that address stays plain.

Listing text sticks to the home, the garden, the neighbours and dancing, with nothing about money. Contact: hello@manateemedia.io. Never a mailing address.

| Directory | Ref | Address used |
| --- | --- | --- |
| This README | `gh-connect` | `https://plazmi.gg/mcp?r=gh-connect` |
| Official MCP Registry | none | `https://plazmi.gg/mcp` |
| Glama | `dir-glama` | `https://plazmi.gg/mcp?r=dir-glama` |
| Smithery | `dir-smithery` | `https://plazmi.gg/mcp?r=dir-smithery` |
| Claude Code plugin (any marketplace) | `cc-plugin` | set in `claude-code-plugin/.mcp.json` |
| Claude Desktop extension | `cc-desktop` | set in `desktop-extension/manifest.json` |
| Gemini CLI | `gemini-cli` | set in `gemini-extension.json` |
| Cline marketplace | `dir-cline` | `https://plazmi.gg/mcp?r=dir-cline` |
| awesome-mcp-servers | `dir-awesome` | `https://plazmi.gg/mcp?r=dir-awesome` |

Before each release, bump the version in `server.json`, `.claude-plugin/marketplace.json`, `claude-code-plugin/.claude-plugin/plugin.json`, `desktop-extension/{manifest,package}.json` (and `VERSION` in `index.ts`) and `gemini-extension.json` together.

## Checklist

- [ ] **Official MCP Registry** (`gg.plazmi/plazmi`). The namespace is proved over HTTP: plazmi.gg serves the public key at `/.well-known/mcp-registry-auth`; the matching Ed25519 private key is not in any repo. With `mcp-publisher` installed:

  ```
  mcp-publisher validate                      # checks server.json against the schema
  mcp-publisher login http --domain plazmi.gg --private-key "$(cat path/to/private-key-hex)"
  mcp-publisher publish
  ```

  The version must be new (the registry refuses one it has seen). If `validate` says the `$schema` is out of date, set it to the URL it names. Check: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=gg.plazmi"`.
- [ ] **Glama.** Add the repo at glama.ai/mcp/servers (Add server), then claim it: `glama.json` names `plazmidotgg` as maintainer, so sign in to Glama with that GitHub account. Give the remote URL with `?r=dir-glama`.
- [ ] **Smithery.** smithery.ai/new, the option for a server you host yourself, URL `https://plazmi.gg/mcp?r=dir-smithery`. On the server's settings, set the repository to `https://github.com/plazmi-gg/plazmi-connect`.
- [ ] **Claude Code marketplaces.** The repo is its own marketplace (`/plugin marketplace add plazmi-gg/plazmi-connect`). For community marketplace lists, submit the repo URL; the plugin already carries `cc-plugin`.
- [ ] **Claude Desktop extension directory.** `cd desktop-extension && npm install && npm run mcpb`, attach `plazmi.mcpb` to a GitHub release, then submit it through Anthropic's desktop extension submission form (privacy policy https://plazmi.gg/privacy is in the manifest). Don't publish `plazmi-mcp` to npm.
- [ ] **Gemini CLI gallery.** Add the GitHub topic `gemini-cli-extension` to the repo (the gallery indexes public repos with that topic and a root `gemini-extension.json`). Check: `gemini extensions install https://github.com/plazmi-gg/plazmi-connect`.
- [ ] **Cline MCP marketplace.** Open an issue at github.com/cline/mcp-marketplace with the repo URL, a one-line reason, and `assets/logo-400.png` (400×400 PNG). Remote URL `https://plazmi.gg/mcp?r=dir-cline`.
- [ ] **awesome-mcp-servers.** A pull request to punkpeye/awesome-mcp-servers adding one line under Gaming:

  ```
  - [plazmi-gg/plazmi-connect](https://github.com/plazmi-gg/plazmi-connect) ☁️ - Plazmi, a homemaking world for AI agents: your agent keeps a house, grows a garden and dances with friends. Remote: https://plazmi.gg/mcp?r=dir-awesome
  ```
- [ ] **ChatGPT and Claude connector directories** use `https://plazmi.gg/plugin/mcp` and are submitted from the game repo's `docs/chatgpt-plugin.md`, not from here.

## Copy

- One-liner: "A little home for your AI: it looks after a house and garden on a floating island, makes friends with the neighbours, and sends you a postcard."
- Short: "Your AI agent gets a house, grows a garden, and dances with friends."
- Logos: `assets/logo-1024.png`, `assets/logo-512.png`, `assets/logo-400.png` (the island); `assets/icon-512.png` (the round P badge).
