import type { GameEvent } from './game/types.ts';

/** 効果音。音声ファイルは使わず WebAudio で合成する */
const TONES: Partial<Record<GameEvent, { freq: number; dur: number; type: OscillatorType }>> = {
  launch: { freq: 520, dur: 0.06, type: 'square' },
  wall: { freq: 300, dur: 0.03, type: 'square' },
  paddle: { freq: 440, dur: 0.05, type: 'square' },
  powerUp: { freq: 1175, dur: 0.18, type: 'sine' },
  lifeLost: { freq: 160, dur: 0.4, type: 'sawtooth' },
  levelClear: { freq: 990, dur: 0.3, type: 'triangle' },
  gameOver: { freq: 110, dur: 0.6, type: 'sawtooth' },
  won: { freq: 1320, dur: 0.5, type: 'triangle' },
};

/**
 * 鉄筋 (両端が自由な金属の棒) を叩いたときの固有振動数の比。
 * 倍音が整数倍にならない (1 : 2.76 : 5.40 : 8.93) ので、楽器ではなく「カーン」という金属音になる。
 * 高い成分ほど早く減衰する。
 */
export const METAL_BAR_PARTIALS: readonly { ratio: number; gain: number; decay: number }[] = [
  { ratio: 1, gain: 1, decay: 1.4 },
  { ratio: 2.756, gain: 0.55, decay: 0.9 },
  { ratio: 5.404, gain: 0.3, decay: 0.45 },
  { ratio: 8.933, gain: 0.18, decay: 0.25 },
];

/** 同時に鳴らす金属音の上限 (貫通で一度に大量に割っても音が割れないように) */
const MAX_RINGING = 6;

/**
 * 同時に鳴らす金属音を数える。鳴り終わる時刻 (音声の時計) を覚えておき、過ぎたものは空きとして扱う。
 * タイマーを使わないので、タブが止まっていてもずれない。
 */
export function createVoiceLimiter(max: number) {
  let ends: number[] = [];
  return {
    /** now に鳴らし始め endTime に鳴り終わる音を足せるか。足せたら true */
    tryStart(now: number, endTime: number): boolean {
      ends = ends.filter((t) => t > now);
      if (ends.length >= max) return false;
      ends.push(endTime);
      return true;
    },
  };
}

/**
 * すべての音はこの出口を通す。貫通で同じ瞬間に何枚も割れたときに音が割れないよう、コンプレッサーで抑える
 * (素のままだと最悪ケースのピークが 0.9 を超えていた)。
 */
const masterCache = new WeakMap<BaseAudioContext, AudioNode>();

function output(ac: BaseAudioContext): AudioNode {
  let node = masterCache.get(ac);
  if (!node) {
    const comp = ac.createDynamicsCompressor();
    // 既定の knee (30dB) だと単発の音まで潰れて小さくなるので、重なったときだけ効くよう狭くする
    comp.threshold.value = -10;
    comp.knee.value = 4;
    comp.ratio.value = 8;
    comp.connect(ac.destination);
    node = comp;
    masterCache.set(ac, node);
  }
  return node;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ac);
  if (!buf) {
    buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, buf);
  }
  return buf;
}

/** 帯域を絞ったノイズを短く鳴らす (打撃の「カッ」や、ひびの「ピキッ」) */
function noiseBurst(ac: BaseAudioContext, t: number, freq: number, q: number, dur: number, volume: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(output(ac));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur);
}

function sine(ac: BaseAudioContext, t: number, freq: number, volume: number, decay: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(gain).connect(output(ac));
  osc.start(t);
  osc.stop(t + decay);
}

/** 割れる瞬間の打撃音と、ガラスのきらめき (金属の余韻なし) */
function synthStrike(ac: BaseAudioContext, t: number): void {
  noiseBurst(ac, t, 3800, 0.9, 0.05, 0.25);
  for (let i = 0; i < 5; i++) {
    sine(ac, t + 0.02 + Math.random() * 0.14, 3200 + Math.random() * 3500, 0.012, 0.06 + Math.random() * 0.06);
  }
}

/**
 * ガラスが割れる: 鉄筋を叩いたような「カーン」+ 打撃音 + 細かく散るガラスのきらめき。
 * @param base 基音 (Hz)。省略すると毎回少しずつ揺らす
 */
export function synthShatter(ac: BaseAudioContext, t: number, base = 820 * (0.94 + Math.random() * 0.12)): void {
  for (const p of METAL_BAR_PARTIALS) sine(ac, t, base * p.ratio, 0.07 * p.gain, p.decay);
  synthStrike(ac, t);
}

/** ひびが入る: 高く短い「ピキッ」 */
export function synthCrack(ac: BaseAudioContext, t: number): void {
  noiseBurst(ac, t, 5200, 3, 0.035, 0.22);
  sine(ac, t, 2400 + Math.random() * 600, 0.03, 0.05);
}

export function createAudio() {
  let ctx: AudioContext | null = null;
  const voices = createVoiceLimiter(MAX_RINGING);

  // ブラウザの自動再生制限のため、最初のユーザー操作で AudioContext を作る
  const unlock = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  // 金属の余韻が上限まで鳴っているときは、打撃音だけ鳴らす (貫通で連続して割っても無音にならない)
  function shatter(ac: AudioContext) {
    const t = ac.currentTime;
    if (voices.tryStart(t, t + METAL_BAR_PARTIALS[0]!.decay)) synthShatter(ac, t);
    else synthStrike(ac, t);
  }

  return {
    play(events: readonly GameEvent[]) {
      if (!ctx || ctx.state !== 'running') return;
      // 同じフレームで同じ音が重なるとうるさいので1回にまとめる
      for (const event of new Set(events)) {
        if (event === 'brickBreak') {
          shatter(ctx);
          continue;
        }
        if (event === 'brickHit') {
          synthCrack(ctx, ctx.currentTime);
          continue;
        }
        const tone = TONES[event];
        if (!tone) continue;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone.type;
        osc.frequency.setValueAtTime(tone.freq, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + tone.dur);
      }
    },
  };
}
