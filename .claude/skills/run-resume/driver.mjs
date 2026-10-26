#!/usr/bin/env node
// Drive the static academic site: serve the repo, run headless Chrome over CDP,
// read commands from stdin (one per line). Zero npm deps: Node >= 22 (global WebSocket).
//
//   node .claude/skills/run-resume/driver.mjs <<'EOF'
//   nav publications.html
//   ss pubs
//   EOF
//
// Commands:
//   nav <page>              load a page (path relative to repo root), wait for load + images
//   viewport <w> <h> [mobile]  set device metrics (mobile => touch + mobile UA layout)
//   ss <name>               full-page screenshot -> $SHOTS/<name>.png
//   ss-el <selector> <name> screenshot one element
//   click <selector>        el.click() on the first match
//   text <selector>         print innerText of the first match
//   count <selector>        print number of matches
//   eval <js>               evaluate JS in the page, print JSON result
//   check                   crawl every *.html: broken local href/src, console errors,
//                           failed requests, horizontal overflow at 390px. Exit 1 on problems.
//   errors                  print console errors / failed requests seen so far
//   quit
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const SHOTS = process.env.SHOTS || path.join(tmpdir(), 'resume-shots');
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };

// --- static server (GitHub Pages serves the repo root as-is) ---
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// --- chrome + CDP ---
if (!CHROME) { console.error('no Chrome found; set CHROME=/path/to/chrome'); process.exit(2); }
const profile = await mkdtemp(path.join(tmpdir(), 'resume-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: 'ignore' });
const portFile = path.join(profile, 'DevToolsActivePort');
for (let i = 0; !existsSync(portFile) || !(await readFile(portFile, 'utf8')).includes('\n'); i++) {
  if (i > 150) throw new Error('Chrome did not start (no DevToolsActivePort)');
  await new Promise((r) => setTimeout(r, 100));
}
const port = (await readFile(portFile, 'utf8')).split('\n')[0];
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let nextId = 0;
const pending = new Map();
const listeners = new Set();
const problems = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const once = (method, ms = 15000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => { listeners.delete(f); reject(new Error(`timeout waiting for ${method}`)); }, ms);
  const f = (msg) => { if (msg.method === method) { clearTimeout(t); listeners.delete(f); resolve(msg.params); } };
  listeners.add(f);
});
const requests = new Map();
listeners.add(({ method, params }) => {
  if (method === 'Runtime.exceptionThrown') problems.push(`exception: ${params.exceptionDetails.exception?.description || params.exceptionDetails.text}`);
  if (method === 'Runtime.consoleAPICalled' && params.type === 'error') problems.push(`console.error: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (method === 'Network.requestWillBeSent') requests.set(params.requestId, params.request.url);
  if (method === 'Network.responseReceived' && params.response.status >= 400) problems.push(`HTTP ${params.response.status}: ${params.response.url}`);
  if (method === 'Network.loadingFailed' && !params.canceled) problems.push(`failed: ${requests.get(params.requestId)} (${params.errorText})`);
});
await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map((m) => send(m)));
await mkdir(SHOTS, { recursive: true });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
let viewport = { width: 1280, height: 900, mobile: false };
const setViewport = (v) => send('Emulation.setDeviceMetricsOverride',
  { width: v.width, height: v.height, deviceScaleFactor: 2, mobile: v.mobile });
await setViewport(viewport);

async function nav(page) {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: new URL(page, BASE).href });
  await loaded;
  // lazy images: force-load so screenshots and checks see them
  await evaluate(`Promise.all([...document.images].map(i => { i.loading = 'eager';
    return i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }); }))`);
}
async function screenshot(name, clip) {
  const params = { format: 'png', captureBeyondViewport: true };
  if (clip) params.clip = { ...clip, scale: 1 };
  else {
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    params.clip = { x: 0, y: 0, width: viewport.width, height: Math.ceil(cssContentSize.height), scale: 1 };
  }
  const { data } = await send('Page.captureScreenshot', params);
  const out = path.join(SHOTS, `${name}.png`);
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log(`screenshot -> ${out}`);
}

async function check() {
  const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html')).sort();
  const issues = [];
  const saved = viewport;
  for (const page of pages) {
    problems.length = 0;
    await nav(page);
    const refs = await evaluate(`[...document.querySelectorAll('[href],[src]')]
      .map(e => e.getAttribute('href') ?? e.getAttribute('src'))`);
    for (const ref of new Set(refs)) {
      if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
      const rel = ref.split(/[?#]/)[0];
      if (rel && !(await stat(path.join(ROOT, rel)).catch(() => null))) issues.push(`${page}: missing local file ${ref}`);
    }
    const broken = await evaluate(`[...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src'))`);
    for (const b of broken) issues.push(`${page}: image did not render ${b}`);
    issues.push(...problems.map((p) => `${page}: ${p}`));
    viewport = { width: 390, height: 844, mobile: true }; await setViewport(viewport);
    await nav(page);
    const over = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    if (over > 0) issues.push(`${page}: horizontal overflow of ${over}px at 390px width`);
    viewport = saved; await setViewport(viewport);
  }
  console.log(issues.length ? issues.join('\n') : `check ok: ${pages.length} pages (${pages.join(', ')})`);
  return issues.length === 0;
}

async function shutdown(code) {
  ws.close(); chrome.kill(); server.close();
  await new Promise((r) => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  process.exit(code);
}

console.log(`ready ${BASE} (shots -> ${SHOTS})`);
let failed = false;
const rl = readline.createInterface({ input: process.stdin, terminal: false });
for await (const raw of rl) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = line.slice(cmd.length).trim();
  try {
    if (cmd === 'nav') { await nav(arg); console.log(`at ${arg}: ${await evaluate('document.title')}`); }
    else if (cmd === 'viewport') {
      viewport = { width: +rest[0], height: +rest[1], mobile: rest[2] === 'mobile' };
      await setViewport(viewport); console.log(`viewport ${rest.join(' ')}`);
    }
    else if (cmd === 'ss') await screenshot(arg || 'page');
    else if (cmd === 'ss-el') {
      const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(rest[0])}).getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
      await screenshot(rest[1] || 'element', box);
    }
    else if (cmd === 'click') { await evaluate(`document.querySelector(${JSON.stringify(arg)}).click()`); console.log(`clicked ${arg}`); }
    else if (cmd === 'text') console.log(await evaluate(`document.querySelector(${JSON.stringify(arg)})?.innerText ?? null`));
    else if (cmd === 'count') console.log(await evaluate(`document.querySelectorAll(${JSON.stringify(arg)}).length`));
    else if (cmd === 'eval') console.log(JSON.stringify(await evaluate(arg), null, 1));
    else if (cmd === 'check') { if (!(await check())) failed = true; }
    else if (cmd === 'errors') console.log(problems.length ? problems.join('\n') : 'no errors');
    else if (cmd === 'quit') break;
    else console.log(`unknown command: ${cmd}`);
  } catch (e) { failed = true; console.log(`error in "${line}": ${e.message}`); }
}
await shutdown(failed ? 1 : 0);
