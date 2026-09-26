import type { GameEvent } from './game/types.ts';

/** 効果音。音声ファイルは使わず WebAudio のオシレーターで鳴らす */
const TONES: Partial<Record<GameEvent, { freq: number; dur: number; type: OscillatorType }>> = {
  launch: { freq: 520, dur: 0.06, type: 'square' },
  wall: { freq: 300, dur: 0.03, type: 'square' },
  paddle: { freq: 440, dur: 0.05, type: 'square' },
  brickHit: { freq: 660, dur: 0.05, type: 'triangle' },
  brickBreak: { freq: 880, dur: 0.08, type: 'triangle' },
  powerUp: { freq: 1175, dur: 0.18, type: 'sine' },
  lifeLost: { freq: 160, dur: 0.4, type: 'sawtooth' },
  levelClear: { freq: 990, dur: 0.3, type: 'triangle' },
  gameOver: { freq: 110, dur: 0.6, type: 'sawtooth' },
  won: { freq: 1320, dur: 0.5, type: 'triangle' },
};

export function createAudio() {
  let ctx: AudioContext | null = null;

  // ブラウザの自動再生制限のため、最初のユーザー操作で AudioContext を作る
  const unlock = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  return {
    play(events: readonly GameEvent[]) {
      if (!ctx || ctx.state !== 'running') return;
      // 同じフレームで同じ音が重なるとうるさいので1回にまとめる
      for (const event of new Set(events)) {
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
