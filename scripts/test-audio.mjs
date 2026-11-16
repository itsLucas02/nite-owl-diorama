#!/usr/bin/env node
/**
 * Regression test for "audio never starts on first load".
 *
 * Browsers reject HTMLMediaElement.play() before a user gesture. The bug was that
 * the very gesture which unlocked playback (pressing `A`) also muted it, and the UI
 * claimed AUDIO: ON while blocked — so audio only became audible on a second press.
 *
 * This asserts the real browser behaviour, which a unit test cannot reach:
 *   1. the restrictive autoplay policy is genuinely in force (otherwise the test is
 *      vacuous — this is the exact gap that let the bug ship)
 *   2. on load, the control does not claim to be on
 *   3. one trusted gesture yields audible, ramping playback
 *   4. a second press mutes
 *
 * Uses only Node built-ins. Requires Node 22+ (global WebSocket) and Chrome.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'a';
const KEYCODE = 65;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const findChrome = () => {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error('Could not find Chrome. Set CHROME_PATH to the browser binary.');
    process.exit(2);
  }
  return found;
};

const waitForHttp = async (url, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      await sleep(200);
    }
  }
  return false;
};

const connect = async (cdpPort) => {
  const info = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' })).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });

  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await new Promise((r) => ws.addEventListener('open', r));
  return { send, close: () => ws.close() };
};

const run = async () => {
  if (!existsSync(path.join(ROOT, 'dist/index.html'))) {
    console.error('dist/index.html is missing. Run `npm run build` first.');
    process.exit(2);
  }

  const chrome = findChrome();
  const sitePort = await freePort();
  const cdpPort = await freePort();
  const profile = mkdtempSync(path.join(os.tmpdir(), 'nite-owl-audio-'));
  const preview = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(sitePort), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' },
  );
  let browser;

  try {
    if (!(await waitForHttp(`http://localhost:${sitePort}/`))) {
      console.error('vite preview did not come up.');
      process.exit(2);
    }

    browser = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--autoplay-policy=document-user-activation-required',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    if (!(await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`))) {
      console.error('Chrome DevTools endpoint did not come up.');
      process.exit(2);
    }

    const { send, close } = await connect(cdpPort);
    await send('Runtime.enable');
    await send('Page.enable');

    // Capture the element the app creates by wrapping play() before app code runs.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__media = [];
        window.__playResults = [];
        const orig = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          if (!window.__media.includes(this)) window.__media.push(this);
          const p = orig.call(this);
          if (p) p.then(
            () => window.__playResults.push('resolved'),
            (e) => window.__playResults.push('rejected:' + e.name)
          );
          return p;
        };
      `,
    });

    const probe = async () => {
      const r = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const a = window.__media[0];
          const ui = document.body.innerText;
          return {
            playResults: window.__playResults.slice(),
            paused: a ? a.paused : null,
            volume: a ? +a.volume.toFixed(3) : null,
            uiSaysOn: ui.includes('AUDIO: ON'),
          };
        })()`,
      });
      return r.result?.result?.value;
    };

    const pressKey = async () => {
      const base = { key: KEY, code: 'KeyA', windowsVirtualKeyCode: KEYCODE, nativeVirtualKeyCode: KEYCODE };
      await send('Input.dispatchKeyEvent', { ...base, type: 'keyDown', text: KEY, unmodifiedText: KEY });
      await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
    };

    await send('Page.navigate', { url: `http://localhost:${sitePort}/` });
    await sleep(2500);

    const onLoad = await probe();
    check(
      'autoplay is blocked before a gesture (else this test proves nothing)',
      onLoad.playResults.includes('rejected:NotAllowedError'),
      JSON.stringify(onLoad.playResults),
    );
    check('load does not claim the audio is on', onLoad.uiSaysOn === false && onLoad.paused === true && onLoad.volume === 0, JSON.stringify(onLoad));

    await pressKey();
    await sleep(2000);
    const afterOne = await probe();
    check(
      'one gesture starts audible playback',
      afterOne.paused === false && afterOne.volume > 0.02,
      `volume ${afterOne.volume}`,
    );
    check('control reports on once playing', afterOne.uiSaysOn === true);

    await sleep(1200);
    const later = await probe();
    check(
      'volume keeps rising rather than starting at peak',
      Number(later.volume) > Number(afterOne.volume) || Number(later.volume) >= 0.299,
      `${afterOne.volume} -> ${later.volume}`,
    );

    await pressKey();
    await sleep(2000);
    const muted = await probe();
    check('a second press mutes', Number(muted.volume) < 0.02 && muted.uiSaysOn === false, `volume ${muted.volume}`);

    close();
  } finally {
    browser?.kill();
    await new Promise((r) => {
      if (!browser || browser.exitCode !== null) return r();
      browser.once('exit', r);
      setTimeout(r, 3000);
    });
    preview.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome can still be releasing the profile directory; not worth failing over.
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

run().catch((e) => {
  console.error('test harness failed:', e);
  process.exit(2);
});
