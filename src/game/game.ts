import {
  BALL_MAX_SPEED,
  BALL_RADIUS,
  BALL_SPEED,
  BALL_SPEED_PER_LEVEL,
  BALL_SPEEDUP_PER_HIT,
  HEIGHT,
  INITIAL_LIVES,
  LAUNCH_ANGLE,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  PADDLE_Y,
  SCORE_BREAK_BONUS,
  SCORE_PER_HIT,
  WIDTH,
} from './constants.ts';
import { LEVELS, parseLevel } from './levels.ts';
import { circleRectHit, paddleBounce, reflect, setSpeed } from './physics.ts';
import type { GameState, Input } from './types.ts';

export type Levels = readonly (readonly string[])[];

const levelSpeed = (level: number) => BALL_SPEED + level * BALL_SPEED_PER_LEVEL;

export function createGame(levels: Levels = LEVELS): GameState {
  const state: GameState = {
    phase: 'ready',
    score: 0,
    lives: INITIAL_LIVES,
    level: 0,
    paddle: { x: (WIDTH - PADDLE_WIDTH) / 2, y: PADDLE_Y, w: PADDLE_WIDTH, h: PADDLE_HEIGHT },
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALL_RADIUS },
    bricks: parseLevel(levels[0] ?? []),
    speed: levelSpeed(0),
    events: [],
  };
  placeBallOnPaddle(state);
  return state;
}

function placeBallOnPaddle(state: GameState): void {
  const { ball, paddle } = state;
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r;
  ball.vx = 0;
  ball.vy = 0;
}

function loadLevel(state: GameState, level: number, levels: Levels): void {
  state.level = level;
  state.bricks = parseLevel(levels[level] ?? []);
  state.speed = levelSpeed(level);
  state.phase = 'ready';
  placeBallOnPaddle(state);
}

function movePaddle(state: GameState, input: Input, dt: number): void {
  const p = state.paddle;
  if (input.pointerX !== null) {
    p.x = input.pointerX - p.w / 2;
  } else {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.x += dir * PADDLE_SPEED * dt;
  }
  p.x = Math.min(WIDTH - p.w, Math.max(0, p.x));
}

function launch(state: GameState, input: Input): void {
  // 押している方向に打ち出す。何も押していなければ少しだけ右へ
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const angle = dir === 0 ? LAUNCH_ANGLE : dir * LAUNCH_ANGLE * 2.5;
  state.ball.vx = state.speed * Math.sin(angle);
  state.ball.vy = -state.speed * Math.cos(angle);
  state.phase = 'playing';
  state.events.push('launch');
}

/** ボールを dt 秒進める。すり抜け防止のため、半径の半分ずつ小刻みに動かす */
function stepBall(state: GameState, dt: number, levels: Levels): void {
  const { ball, paddle } = state;
  const steps = Math.max(1, Math.ceil((state.speed * dt) / (ball.r / 2)));
  const sub = dt / steps;

  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx * sub;
    ball.y += ball.vy * sub;

    // 壁
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      state.events.push('wall');
    } else if (ball.x + ball.r > WIDTH) {
      ball.x = WIDTH - ball.r;
      ball.vx = -Math.abs(ball.vx);
      state.events.push('wall');
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      state.events.push('wall');
    }

    // パドル (落ちてくるときだけ)
    if (ball.vy > 0 && circleRectHit(ball, paddle)) {
      paddleBounce(ball, paddle, state.speed);
      state.events.push('paddle');
    }

    // ブロック (1ステップで当たるのは1個まで)
    for (let b = 0; b < state.bricks.length; b++) {
      const brick = state.bricks[b]!;
      const hit = circleRectHit(ball, brick);
      if (!hit) continue;
      reflect(ball, hit);
      brick.hp -= 1;
      state.score += SCORE_PER_HIT;
      state.speed = Math.min(BALL_MAX_SPEED, state.speed + BALL_SPEEDUP_PER_HIT);
      setSpeed(ball, state.speed);
      if (brick.hp <= 0) {
        state.score += SCORE_BREAK_BONUS * brick.maxHp;
        state.bricks.splice(b, 1);
        state.events.push('brickBreak');
      } else {
        state.events.push('brickHit');
      }
      break;
    }

    if (state.bricks.length === 0) {
      const last = state.level >= levels.length - 1;
      state.phase = last ? 'won' : 'levelClear';
      state.events.push(last ? 'won' : 'levelClear');
      return;
    }

    // 落下
    if (ball.y - ball.r > HEIGHT) {
      state.lives -= 1;
      state.events.push('lifeLost');
      if (state.lives <= 0) {
        state.phase = 'gameOver';
        state.events.push('gameOver');
      } else {
        state.phase = 'ready';
        state.speed = levelSpeed(state.level);
        placeBallOnPaddle(state);
      }
      return;
    }
  }
}

/** 1フレーム進める。state を直接書き換える */
export function update(state: GameState, input: Input, dt: number, levels: Levels = LEVELS): void {
  state.events = [];

  if (input.pause) {
    if (state.phase === 'playing') {
      state.phase = 'paused';
      return;
    }
    if (state.phase === 'paused') {
      state.phase = 'playing';
      return;
    }
  }

  switch (state.phase) {
    case 'paused':
      return;
    case 'ready':
      movePaddle(state, input, dt);
      placeBallOnPaddle(state);
      if (input.action) launch(state, input);
      return;
    case 'playing':
      movePaddle(state, input, dt);
      stepBall(state, dt, levels);
      return;
    case 'levelClear':
      if (input.action) loadLevel(state, state.level + 1, levels);
      return;
    case 'gameOver':
    case 'won':
      if (input.action) Object.assign(state, createGame(levels));
      return;
  }
}

/** 一時停止を解除する手段を持たない場面 (タブ切り替えなど) 用 */
export function pause(state: GameState): void {
  if (state.phase === 'playing') state.phase = 'paused';
}
