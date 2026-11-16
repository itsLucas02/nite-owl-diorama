const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface AmbienceOptions {
  /** Peak volume, 0..1. */
  peak?: number;
  /** Seconds the track takes to rise out of silence at the start of each cycle. */
  fadeIn?: number;
  /** Seconds the track spends falling back to silence before the loop point. */
  fadeOut?: number;
  /** Time constant for volume smoothing, so fades never step or click. */
  smooth?: number;
}

/**
 * Looping ambient bed whose volume is derived from the playback position:
 * silent at the seam, rising over `fadeIn`, falling over `fadeOut`. Because the
 * element loops natively, `currentTime` wraps on its own and the fades restart
 * without any bookkeeping.
 */
export class Ambience {
  private el: HTMLAudioElement;
  private peak: number;
  private fadeIn: number;
  private fadeOut: number;
  private smooth: number;
  private mutedFlag = false;
  private started = false;

  constructor(src: string, opts: AmbienceOptions = {}) {
    this.peak = opts.peak ?? 0.3;
    this.fadeIn = opts.fadeIn ?? 7;
    this.fadeOut = opts.fadeOut ?? 7;
    this.smooth = opts.smooth ?? 0.4;
    this.el = new Audio(src);
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = 0;
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  /** Browsers refuse playback until a gesture; resolves false when blocked. */
  start(): Promise<boolean> {
    if (this.started && !this.el.paused) return Promise.resolve(true);
    const p = this.el.play();
    if (!p) return Promise.resolve(true);
    return p.then(
      () => {
        this.started = true;
        return true;
      },
      () => false,
    );
  }

  toggleMute(): boolean {
    this.mutedFlag = !this.mutedFlag;
    return this.mutedFlag;
  }

  /** Call once per frame: ramps toward the volume this moment of the loop wants. */
  update(dt: number) {
    const k = 1 - Math.exp(-dt / this.smooth);
    const next = this.el.volume + (this.target() - this.el.volume) * k;
    this.el.volume = next < 0.001 ? 0 : Math.min(1, next);
  }

  private target(): number {
    if (!this.started || this.el.paused || this.mutedFlag) return 0;
    const dur = this.el.duration;
    if (!Number.isFinite(dur) || dur <= 0) return 0;
    const t = this.el.currentTime;
    return this.peak * clamp01(t / this.fadeIn) * clamp01((dur - t) / this.fadeOut);
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }
}
