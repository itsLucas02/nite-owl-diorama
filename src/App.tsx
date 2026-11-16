import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Scene, W, H } from './scene/scene';
import { Ambience } from './audio/ambience';

const RAIN = [
  { name: 'DRIZZLE', v: 0.45 },
  { name: 'STEADY', v: 0.75 },
  { name: 'DOWNPOUR', v: 1 },
];

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const initialRain = Math.min(2, Math.max(0, parseInt(params.get('rain') ?? '1', 10) || 0));

interface Info { w: number; h: number; scale: number; exact: boolean }

function Key({ k, label, active, onClick }: { k: string; label: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 px-2 py-2 text-[13px] leading-none transition-colors ${
        active ? 'text-[#ffd87a]' : 'text-[#8fbfc8] hover:text-[#fff2c4]'
      }`}
    >
      <span
        className={`min-w-[24px] border px-1.5 py-1 text-center text-[12px] ${
          active ? 'border-[#f7b040] bg-[#4a1f12] text-[#ffd87a]' : 'border-[#34507f] bg-[#0b0e20] text-[#a8fbfb] group-hover:border-[#ff2e88]'
        }`}
      >
        {k}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function App() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const timeRef = useRef(Math.max(0, parseFloat(params.get('t') ?? '') || 24));
  const pausedRef = useRef(false);
  const fillRef = useRef(params.get('mode') === 'fill');
  const idleTimer = useRef(0);
  const toastTimer = useRef(0);

  const [ready, setReady] = useState(false);
  const [clean, setClean] = useState(params.get('clean') === '1');
  const [idle, setIdle] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fill, setFill] = useState(fillRef.current);
  const [rain, setRain] = useState(initialRain);
  const [isFs, setIsFs] = useState(false);
  const [info, setInfo] = useState<Info>({ w: W * 3, h: H * 3, scale: 3, exact: true });
  const [toast, setToast] = useState('');
  const ambRef = useRef<Ambience | null>(null);
  const [audioOn, setAudioOn] = useState(true);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  /** Size the backing store in *device* pixels so every source pixel is an exact NxN block. */
  const layout = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const aw = Math.max(1, Math.floor(wrap.clientWidth * dpr));
    const ah = Math.max(1, Math.floor(wrap.clientHeight * dpr));
    const s = Math.floor(Math.min(aw / W, ah / H));
    let bw: number;
    let bh: number;
    let exact = true;
    if (!fillRef.current && s >= 1) {
      bw = W * s;
      bh = H * s;
    } else {
      const k = Math.min(aw / W, ah / H);
      bw = Math.max(1, Math.floor(W * k));
      bh = Math.max(1, Math.floor(H * k));
      exact = Number.isInteger(k);
    }
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    cv.style.width = `${bw / dpr}px`;
    cv.style.height = `${bh / dpr}px`;
    cv.style.left = `${Math.floor((aw - bw) / 2) / dpr}px`;
    cv.style.top = `${Math.floor((ah - bh) / 2) / dpr}px`;
    setInfo((p) => (p.w === bw && p.h === bh && p.exact === exact ? p : { w: bw, h: bh, scale: bw / W, exact }));
  }, []);

  // ---- build the world + run it
  useEffect(() => {
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let lastClock = -1;
    const boot = window.setTimeout(() => {
      const scene = new Scene();
      scene.rainLevel = RAIN[initialRain].v;
      sceneRef.current = scene;
      setReady(true);
      layout();
      const tick = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(tick);
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.1) dt = 0.1; // tab was hidden: never jump, just carry on
        ambRef.current?.update(dt);
        if (pausedRef.current) dt = 0;
        timeRef.current += dt;
        scene.frame(timeRef.current, dt);
        const cv = canvasRef.current;
        if (cv) {
          const ctx = cv.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(scene.cv, 0, 0, cv.width, cv.height);
          }
        }
        const sec = Math.floor(timeRef.current);
        if (sec !== lastClock && clockRef.current) {
          lastClock = sec;
          const p = (n: number) => String(n).padStart(2, '0');
          clockRef.current.textContent = `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
        }
      };
      raf = requestAnimationFrame(tick);
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(boot);
      cancelAnimationFrame(raf);
    };
  }, [layout]);

  // ---- actions
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => say('FULLSCREEN BLOCKED BY BROWSER'));
  }, [say]);
  const toggleClean = useCallback(() => {
    setClean((c) => {
      if (!c) say('CLEAN CAPTURE MODE · PRESS H TO BRING THE INTERFACE BACK');
      return !c;
    });
  }, [say]);
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);
  const toggleFill = useCallback(() => {
    fillRef.current = !fillRef.current;
    setFill(fillRef.current);
    layout();
  }, [layout]);
  const cycleRain = useCallback(() => {
    setRain((r) => {
      const n = (r + 1) % RAIN.length;
      if (sceneRef.current) sceneRef.current.rainLevel = RAIN[n].v;
      return n;
    });
  }, []);
  const snapshot = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const c = document.createElement('canvas');
    c.width = 1920;
    c.height = 1080;
    const x = c.getContext('2d');
    if (!x) return;
    x.imageSmoothingEnabled = false;
    x.drawImage(scene.cv, 0, 0, 1920, 1080);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `nite-owl-1080p-${Math.floor(timeRef.current)}s.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
    say('SAVED 1920×1080 FRAME');
  }, [say]);

  const toggleAudio = useCallback(() => {
    const amb = ambRef.current;
    if (!amb) return;
    const muted = amb.toggleMute();
    setAudioOn(!muted);
    say(muted ? 'AUDIO OFF' : 'AUDIO ON');
  }, [say]);

  // ---- ambience: browsers block playback until a gesture, so the first
  // click or keypress is what actually starts it.
  useEffect(() => {
    const amb = new Ambience(`${import.meta.env.BASE_URL}cry-audio.mp3`);
    ambRef.current = amb;
    void amb.start().then((ok) => {
      if (!ok) say('CLICK OR PRESS ANY KEY FOR SOUND');
    });
    const unlock = () => void amb.start();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      ambRef.current = null;
      amb.dispose();
    };
  }, [say]);

  // ---- window events
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 3500);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') toggleFs();
      else if (k === 'h') toggleClean();
      else if (k === ' ' || k === 'p') {
        e.preventDefault();
        togglePause();
      } else if (k === 'm') toggleFill();
      else if (k === 'r') cycleRain();
      else if (k === 's') snapshot();
      else if (k === 'a') toggleAudio();
      else return;
      wake();
    };
    const onFs = () => {
      setIsFs(!!document.fullscreenElement);
      layout();
    };
    const ro = new ResizeObserver(layout);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', layout);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    document.addEventListener('fullscreenchange', onFs);
    wake();
    layout();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      document.removeEventListener('fullscreenchange', onFs);
      window.clearTimeout(idleTimer.current);
    };
  }, [layout, toggleFs, toggleClean, togglePause, toggleFill, cycleRain, snapshot, toggleAudio]);

  const hidden = clean || idle;
  const fade = `transition-opacity duration-500 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`;
  const scaleLabel = Number.isInteger(info.scale) ? `${info.scale}×` : `${info.scale.toFixed(2)}×`;

  return (
    <div
      ref={wrapRef}
      onDoubleClick={toggleFs}
      className={`pixel-font relative h-full w-full select-none overflow-hidden bg-black ${hidden ? 'cursor-none' : ''}`}
    >
      <canvas ref={canvasRef} className="stage" width={W * 3} height={H * 3} aria-label="Animated cyberpunk pixel-art rooftop in the rain" />

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04050c] text-[#ff2e88]">
          <div className="text-2xl tracking-widest">NITE OWL</div>
          <div className="animate-pulse text-[11px] text-[#8fbfc8]">WARMING UP THE NEON…</div>
        </div>
      )}

      {/* title */}
      <div className={`absolute left-4 top-4 ${fade}`}>
        <div className="hud-panel px-3 py-2">
          <div className="text-2xl leading-none text-[#ff2e88]">
            NITE OWL <span className="text-[#ffd87a]">☾</span>
          </div>
          <div className="mt-2 text-[12px] leading-none text-[#8fbfc8]">ROOFTOP 7F · SECTOR 12 · 02:37 AM · 2089</div>
        </div>
      </div>

      {/* render info */}
      <div className={`absolute right-4 top-4 ${fade}`}>
        <div className="hud-panel px-3 py-2 text-right text-[12px] leading-relaxed text-[#8fbfc8]">
          <div>
            {W}×{H} → <span className="text-[#a8fbfb]">{info.w}×{info.h}</span> · {scaleLabel} NEAREST
          </div>
          <div className={info.exact ? 'text-[#4dffa6]' : 'text-[#f7b040]'}>
            {info.exact ? 'PIXEL-PERFECT INTEGER SCALE' : 'NON-INTEGER FILL (UNEVEN PIXELS)'}
          </div>
          <div>
            RUNTIME <span ref={clockRef} className="text-[#ffd87a]">00:00:00</span> · NO LOOP POINT
          </div>
        </div>
      </div>

      {/* controls */}
      <div className={`absolute bottom-4 left-1/2 max-w-[96vw] -translate-x-1/2 ${fade}`}>
        <div className="hud-panel flex flex-wrap items-center justify-center gap-x-2 px-2 py-1">
          <Key k="F" label={isFs ? 'EXIT FULLSCREEN' : 'FULLSCREEN'} active={isFs} onClick={toggleFs} />
          <Key k="H" label="HIDE UI" onClick={toggleClean} />
          <Key k="R" label={`RAIN: ${RAIN[rain].name}`} onClick={cycleRain} />
          <Key k="M" label={fill ? 'SCALE: FILL' : 'SCALE: INTEGER'} active={fill} onClick={toggleFill} />
          <Key k="P" label={paused ? 'RESUME' : 'PAUSE'} active={paused} onClick={togglePause} />
          <Key k="S" label="SAVE 1080P FRAME" onClick={snapshot} />
          <Key k="A" label={audioOn ? 'AUDIO: ON' : 'AUDIO: OFF'} active={!audioOn} onClick={toggleAudio} />
        </div>
        <div className="mt-2 text-center text-[11px] leading-relaxed text-[#8fbfc8]" style={{ textShadow: '1px 1px 0 #000' }}>
          FOR CAPTURE: PRESS F THEN H · AT 1920×1080 THE SCENE IS AN EXACT 3× UPSCALE · OBS BROWSER SOURCE: ADD ?CLEAN=1
        </div>
      </div>

      {/* toast (also shown in clean mode, then gone) */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${
          toast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="hud-panel px-5 py-3 text-center text-[14px] text-[#ffd87a]">{toast || ' '}</div>
      </div>
    </div>
  );
}
