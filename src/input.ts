import { WIDTH } from './game/constants.ts';
import type { Input } from './game/types.ts';

export interface InputSource {
  /** 現在の入力を返し、「押された瞬間」フラグをリセットする */
  read(): Input;
  /** M キーで切り替わる消音フラグ */
  readonly muted: boolean;
}

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const ACTION = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas: HTMLCanvasElement): InputSource {
  let left = false;
  let right = false;
  let pointerX: number | null = null;
  let action = false;
  let pause = false;
  let muted = false;

  const toLogicalX = (clientX: number) => {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * WIDTH;
  };

  window.addEventListener('keydown', (e) => {
    if (LEFT.has(e.code)) left = true;
    else if (RIGHT.has(e.code)) right = true;
    else if (ACTION.has(e.code)) action = !e.repeat || action;
    else if (PAUSE.has(e.code)) pause = !e.repeat || pause;
    else if (e.code === 'KeyM' && !e.repeat) muted = !muted;
    else return;
    // キーボードで動かし始めたらマウス位置での操作をやめる
    if (LEFT.has(e.code) || RIGHT.has(e.code)) pointerX = null;
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (LEFT.has(e.code)) left = false;
    if (RIGHT.has(e.code)) right = false;
  });
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    pointerX = toLogicalX(e.clientX);
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointerX = toLogicalX(e.clientX);
    action = true;
    canvas.setPointerCapture(e.pointerId);
  });

  return {
    read() {
      const input: Input = { left, right, pointerX, action, pause };
      action = false;
      pause = false;
      return input;
    },
    get muted() {
      return muted;
    },
  };
}
