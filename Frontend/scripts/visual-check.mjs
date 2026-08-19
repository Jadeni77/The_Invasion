/**
 * Screenshot every lobby screen from a real browser, and measure it.
 *
 * WHY THIS EXISTS. jsdom - what Vitest runs - has no layout engine, no
 * rasteriser, and ignores `pointer-events` for synthetic clicks. Two lobby PRs
 * merged with the whole suite green and the screen broken, and the bugs were of
 * kinds no jsdom test can reach: a viewport that grew to its content so the
 * document scrolled instead of the map, route segments drawn from the wrong
 * anchor, `setPointerCapture` making every node and chest unclickable, a glow
 * element swallowing chest clicks, and a node oscillating between two sizes
 * because hovering it moved its own label out from under the cursor.
 *
 * A green suite is not evidence about layout, hit-testing or paint. Look at the
 * page.
 *
 * USAGE
 *   Backend:  cd Backend && ./mvnw spring-boot:run
 *   Frontend: cd Frontend && npm run dev
 *   Then:     node scripts/visual-check.mjs <outdir> [width] [height]
 *
 * Needs Google Chrome installed; drives it over the DevTools Protocol with
 * Node's built-in WebSocket, so there is no dependency to install.
 *
 * Beyond screenshots, the useful calls are:
 *   - `document.elementFromPoint(x, y)` to find what a click would ACTUALLY hit
 *   - `Input.dispatchMouseEvent` for real clicks and drags; `element.click()`
 *     will not reproduce pointer-capture or `pointer-events` bugs
 *   - `Page.addScriptToEvaluateOnNewDocument` to patch `AudioContext.prototype`
 *     before the app boots, to see which frequencies a sound really creates
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [outdir, w = '1470', h = '956'] = process.argv.slice(2);
const PORT = 9343;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--window-size=${w},${h}`, '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=/tmp/cdp-screens-' + Date.now(), 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let page;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = list.find((t) => t.type === 'page');
    if (page) break;
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id && pending.has(g.id)) { pending.get(g.id)(g); pending.delete(g.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });

await send('Page.navigate', { url: 'http://localhost:5173' });
await sleep(2500);

// Real login through the real form.
await ev(`(() => {
  const setVal = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const inputs = [...document.querySelectorAll('input')];
  setVal(inputs.find(i => i.type === 'email' || /email/i.test(i.placeholder || '')), 'test@example.com');
  setVal(inputs.find(i => i.type === 'password'), 'test123');
  [...document.querySelectorAll('button')].find(b => /log\\s*in/i.test(b.textContent)).click();
  return 'submitted';
})()`);
await sleep(5000);
console.log('logged in, lobby present:', await ev(`!!document.querySelector('.lobby-container')`));

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${outdir}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('  wrote ' + name + '.png');
}

async function clickButtonByText(re) {
  return await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => ${re}.test(b.textContent));
    if (!b) return 'not found';
    b.click();
    return 'clicked ' + b.textContent.trim();
  })()`);
}

/** Measure how much of the viewport a screen's content actually occupies. */
async function fill(label, sel) {
  console.log('  ' + label + ': ' + await ev(`(() => {
    const el = document.querySelector('${sel}');
    if (!el) return 'MISSING ${sel}';
    const r = el.getBoundingClientRect();
    const pct = Math.round((r.width * r.height) / (innerWidth * innerHeight) * 100);
    return Math.round(r.width) + 'x' + Math.round(r.height) + ' of ' + innerWidth + 'x' + innerHeight + '  = ' + pct + '% of viewport';
  })()`));
}

await shot('01-lobby');
await fill('lobby', '.lobby-container');

console.log(await clickButtonByText('/upgrade/i'));
await sleep(1500);
await shot('02-upgrade');
await fill('upgrade panel', '.upgrade-modal, .modal-content, .upgrade-container');
console.log('  upgrade root class: ' + await ev(`document.body.firstElementChild?.firstElementChild?.className || '?'`));

await send('Page.reload'); await sleep(4000);
console.log(await clickButtonByText('/settings/i'));
await sleep(1500);
await shot('03-settings');
await fill('settings panel', '.setting-modal, .settings-modal, .modal-content');
console.log('  settings root class: ' + await ev(`document.body.firstElementChild?.firstElementChild?.className || '?'`));

await send('Page.reload'); await sleep(4000);
console.log(await clickButtonByText('/collection/i'));
await sleep(1500);
await shot('04-collection');

await send('Page.reload'); await sleep(4000);
console.log(await clickButtonByText('/achievement/i'));
await sleep(1500);
await shot('05-achievements');

ws.close(); chrome.kill(); process.exit(0);
