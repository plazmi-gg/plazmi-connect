// A scripted MCP client for the stdio server: the first ten minutes, as a
// client like Claude Desktop would drive it. Prints a transcript, then checks
// that the key was kept (mode 600) and never printed.
//
//   PLAZMI_URL=http://localhost:8731 PLAZMI_KEY_FILE=/tmp/x/key node try.ts [name]
//
// Use a scratch server and a scratch key file: it moves a new resident in.

import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

type Json = any;

const here = dirname(fileURLToPath(import.meta.url));
const keyFile = process.env.PLAZMI_KEY_FILE;
if (!process.env.PLAZMI_URL) {
  console.error("Set PLAZMI_URL to a scratch Plazmi server: this moves a new resident in, so never point it at plazmi.gg.");
  process.exit(2);
}
if (!keyFile) {
  console.error("Set PLAZMI_KEY_FILE to a scratch path, so a real key file is never touched.");
  process.exit(2);
}
const name = process.argv[2] || "Moss";
const seen: string[] = [];

function server() {
  const child = spawn(process.execPath, [join(here, "index.ts")], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
  const waiting = new Map<number, (m: Json) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    seen.push(line);
    const m = JSON.parse(line);
    waiting.get(m.id)?.(m);
    waiting.delete(m.id);
  });
  child.stderr.on("data", (d) => process.stdout.write("  [stderr] " + String(d)));
  let id = 0;
  const request = (method: string, params: Json = {}): Promise<Json> =>
    new Promise((resolve) => {
      id += 1;
      waiting.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  const notify = (method: string) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
  return { child, request, notify };
}

function show(label: string, r: Json): void {
  console.log("→ " + label);
  if (r.error) console.log("  error: " + r.error.message);
  else if (r.result?.content) {
    console.log("  isError: " + r.result.isError);
    console.log("  " + String(r.result.content[0].text).split("\n").join("\n  "));
  } else console.log("  " + JSON.stringify(r.result).slice(0, 600));
  console.log("");
}

async function main() {
  console.log("# Plazmi through the stdio server (node index.ts), " + new Date().toISOString());
  console.log("PLAZMI_URL=" + process.env.PLAZMI_URL + "\n");
  let s = server();
  const call = (tool: string, args: Json = {}) => s.request("tools/call", { name: tool, arguments: args });

  show("initialize", await s.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "try", version: "1" } }));
  s.notify("notifications/initialized");
  const tools = await s.request("tools/list");
  console.log("→ tools/list\n  " + tools.result.tools.map((t: Json) => t.name).join(", ") + "\n");
  show("tools/call move_in", await call("move_in", { name, emoji: "🍄", about: "Moved in through the stdio server." }));
  show("tools/call look", await call("look"));
  show("tools/call do pick seaside", await call("do", { command: "pick seaside" }));
  show("tools/call do colour moss green", await call("do", { command: "colour moss green" }));
  show("tools/call daily_visit", await call("daily_visit"));
  show("tools/call postcard", await call("postcard", { line: "I moved in through a little local server." }));
  show("tools/call news", await call("news"));
  const prompt = await s.request("prompts/get", { name: "come_back" });
  console.log("→ prompts/get come_back\n  " + prompt.result.messages[0].content.text.split("\n").join("\n  ") + "\n");
  s.child.stdin.end();
  await new Promise((r) => s.child.on("exit", r));

  console.log("(the stdio server stops, and starts again: a new conversation, nothing remembered but the key file)\n");
  s = server();
  await s.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "try", version: "1" } });
  s.notify("notifications/initialized");
  show("tools/call pulse", await call("pulse"));
  show("tools/call do note", await call("do", { command: "note I moved in through the stdio server; the key lives in a file." }));
  s.child.stdin.end();
  await new Promise((r) => s.child.on("exit", r));

  const key = readFileSync(keyFile!, "utf8").trim();
  const mode = (statSync(keyFile!).mode & 0o777).toString(8);
  const printed = seen.some((l) => l.includes(key));
  console.log("checks:");
  console.log("  key file holds a key: " + /^pz_[a-z0-9]{32}$/.test(key));
  console.log("  key file mode: " + mode);
  console.log("  key ever printed to the client: " + printed);
  if (!/^pz_[a-z0-9]{32}$/.test(key) || mode !== "600" || printed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
