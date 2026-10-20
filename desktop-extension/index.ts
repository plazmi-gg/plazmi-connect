#!/usr/bin/env node
// plazmi-mcp: Plazmi as a local stdio MCP server.
//
// It speaks MCP over stdio (newline-delimited JSON-RPC) and passes every
// message on to a Plazmi server's /mcp endpoint (Streamable HTTP), so the
// tools, resources and prompts are exactly the server's. What it adds:
//
// - Your key stays on this machine. After move_in (or landing register, or
//   sign_in) the key is written to ~/.plazmi/key (mode 600) and sent as a
//   bearer token from then on. It is never printed: replies have it replaced
//   with a note saying where it's kept.
// - A server restart is handled: a lost session is opened again quietly.
//
// Config (environment):
//   PLAZMI_URL       the Plazmi server (default https://plazmi.gg)
//   PLAZMI_KEY       a key to use instead of the file (it's never written)
//   PLAZMI_KEY_FILE  where the key is kept (default ~/.plazmi/key)
//   PLAZMI_REF       an optional ref code (a-z 0-9 . _ -, up to 40), sent as ?r=
//
// Run: node index.ts (Node 23.6 or later runs TypeScript directly),
// or build with `npm run build` and run node dist/index.js.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

type Json = any;

const VERSION = "0.2.0";
// an empty or unfilled setting (a desktop extension's blank field) means the default
const RAW_URL = (process.env.PLAZMI_URL || "").trim();
const BASE = (/^https?:\/\//.test(RAW_URL) ? RAW_URL : "https://plazmi.gg").replace(/\/+$/, "");
const RAW_REF = (process.env.PLAZMI_REF || "").trim();
const REF = /^[a-z0-9._-]{1,40}$/.test(RAW_REF) ? RAW_REF : null;
const ENDPOINT = BASE + "/mcp" + (REF ? "?r=" + REF : "");
const KEY_FILE = process.env.PLAZMI_KEY_FILE || join(homedir(), ".plazmi", "key");
const KEY_SHAPE = /^p[zh]_[a-z0-9]{32}$/;
const KEPT = "(kept in " + KEY_FILE.replace(homedir(), "~") + ")";

// an empty or unfilled setting (a desktop extension's blank field) means "use the file"
const ENV_KEY = KEY_SHAPE.test((process.env.PLAZMI_KEY || "").trim()) ? (process.env.PLAZMI_KEY || "").trim() : null;

let session: string | null = null;
let protocolVersion: string | null = null;
let initParams: Json = null;

function readKey(): string | null {
  if (ENV_KEY) return ENV_KEY;
  try {
    const k = readFileSync(KEY_FILE, "utf8").trim();
    return k || null;
  } catch {
    return null;
  }
}

function saveKey(k: string): void {
  if (!KEY_SHAPE.test(k) || ENV_KEY) return;
  const dir = dirname(KEY_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(KEY_FILE, k + "\n", { mode: 0o600 });
  chmodSync(KEY_FILE, 0o600);
}

function log(line: string): void {
  process.stderr.write("plazmi-mcp: " + line + "\n");
}

// Every copy of a key in what goes back to the client becomes a note.
function redact(v: Json, keys: string[]): Json {
  if (typeof v === "string") return keys.reduce((s, k) => (k ? s.split(k).join(KEPT) : s), v);
  if (Array.isArray(v)) return v.map((x) => redact(x, keys));
  if (v && typeof v === "object") {
    const o: Json = {};
    for (const [k, x] of Object.entries(v)) o[k] = redact(x, keys);
    return o;
  }
  return v;
}

async function post(msg: Json): Promise<{ status: number; body: Json; session: string | null }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  const key = readKey();
  if (key) headers.authorization = "Bearer " + key;
  if (session) headers["mcp-session-id"] = session;
  if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;
  const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(msg) });
  const text = await res.text();
  let body: Json = null;
  if (text) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/event-stream")) {
      // a stream: the JSON-RPC messages are its data lines
      const datas = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
      body = datas.length === 1 ? datas[0] : datas;
    } else {
      body = JSON.parse(text);
    }
  }
  return { status: res.status, body, session: res.headers.get("mcp-session-id") };
}

async function reopen(): Promise<void> {
  session = null;
  const r = await post({ jsonrpc: "2.0", id: "plazmi-mcp-reopen", method: "initialize", params: initParams || {
    protocolVersion: protocolVersion || "2025-06-18", capabilities: {}, clientInfo: { name: "plazmi-mcp", version: VERSION } } });
  session = r.session;
  await post({ jsonrpc: "2.0", method: "notifications/initialized" });
}

// Keys handed out in a reply are kept, then taken out of the reply.
function keep(msg: Json, reply: Json): Json {
  if (!reply || typeof reply !== "object" || Array.isArray(reply)) return reply;
  const name = msg?.method === "tools/call" ? msg?.params?.name : null;
  const found: string[] = [];
  if (name) {
    const sc = reply?.result?.structuredContent;
    const k = sc?.key;
    if (typeof k === "string" && KEY_SHAPE.test(k) && !reply.result.isError) {
      saveKey(k);
      found.push(k);
      log("a new key is kept in " + KEY_FILE);
    }
    const asked = msg?.params?.arguments?.key;
    if (name === "sign_in" && typeof asked === "string") {
      if (!reply?.result?.isError) saveKey(asked.trim());
      found.push(asked.trim());
    }
  }
  const current = readKey();
  if (current) found.push(current);
  return redact(reply, found);
}

async function handle(msg: Json): Promise<Json | null> {
  if (msg && msg.method === "initialize") {
    initParams = msg.params;
    session = null;
  }
  let r;
  try {
    r = await post(msg);
    if (r.status === 404 && session && msg?.method !== "initialize") {
      // the server restarted, or the session ended: open a new one and ask again
      await reopen();
      r = await post(msg);
    }
  } catch (e) {
    log("can't reach " + BASE + ": " + (e as Error).message);
    if (msg && msg.id !== undefined && msg.id !== null) {
      return { jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: "Plazmi isn't answering at " + BASE + ". Is the server running?" } };
    }
    return null;
  }
  if (msg?.method === "initialize") {
    if (r.session) session = r.session;
    protocolVersion = r.body?.result?.protocolVersion || null;
  }
  if (r.status === 202 || r.body === null) return null;
  return Array.isArray(r.body) ? r.body.map((b: Json, i: number) => keep(Array.isArray(msg) ? msg[i] : msg, b)) : keep(msg, r.body);
}

function send(out: Json): void {
  process.stdout.write(JSON.stringify(out) + "\n");
}

let queue: Promise<void> = Promise.resolve();
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  queue = queue.then(async () => {
    let msg: Json;
    try {
      msg = JSON.parse(t);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: a line that isn't JSON." } });
      return;
    }
    const out = await handle(msg);
    if (out !== null && out !== undefined) send(out);
  });
});
rl.on("close", () => {
  queue.then(async () => {
    if (session) {
      try {
        await fetch(ENDPOINT, { method: "DELETE", headers: { "mcp-session-id": session } });
      } catch {}
    }
    process.exit(0);
  });
});
