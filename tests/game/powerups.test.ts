import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HEIGHT,
  INITIAL_LIVES,
  MAX_BALLS,
  PADDLE_WIDTH,
  PIERCE_DURATION,
  POWERUP_HEIGHT,
  POWERUP_WIDTH,
  WIDE_DURATION,
  WIDE_SCALE,
  WIDTH,
} from '../../src/game/constants.ts';
import { applyPowerUp, createGame, update } from '../../src/game/game.ts';
import { LEVELS } from '../../src/game/levels.ts';
import { NO_INPUT, type GameState, type Input, type PowerUpKind } from '../../src/game/types.ts';

const DT = 1 / 120;
const input = (patch: Partial<Input> = {}): Input => ({ ...NO_INPUT, ...patch });
const ONE_BRICK = [['....1....1']];

function launched(levels: string[][] = ONE_BRICK, dropChance = 0): GameState {
  const s = createGame(levels, { dropChance, seed: 7 });
  update(s, input({ action: true }), DT, levels);
  return s;
}

/** パドルのすぐ上にアイテムを置き、パドルで受け取る */
function catchPowerUp(s: GameState, kind: PowerUpKind, levels = ONE_BRICK): void {
  const p = s.paddle;
  s.powerUps.push({ kind, x: p.x + p.w / 2 - POWERUP_WIDTH / 2, y: p.y - POWERUP_HEIGHT - 1, w: POWERUP_WIDTH, h: POWERUP_HEIGHT });
  // ボールが邪魔しないよう画面中央でほぼ止めておく (ゆっくり上へ)
  Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -1 });
  update(s, input({ pointerX: p.x + p.w / 2 }), 0.05, levels);
}

/** ボールをブロックの真下から真上へ撃つ */
function shootAt(s: GameState, index = 0) {
  const brick = s.bricks[index]!;
  Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
  return brick;
}

describe('アイテムの出現と取得', () => {
  it('ブロックを壊すと、その位置からアイテムが落ちてくる (確率1の場合)', () => {
    const s = launched(ONE_BRICK, 1);
    const brick = shootAt(s);
    for (let i = 0; i < 20 && s.powerUps.length === 0; i++) update(s, NO_INPUT, DT, ONE_BRICK);
    assert.equal(s.powerUps.length, 1);
    const item = s.powerUps[0]!;
    assert.ok(Math.abs(item.x + item.w / 2 - (brick.x + brick.w / 2)) < 1e-9);
    const y0 = item.y;
    update(s, NO_INPUT, 0.1, ONE_BRICK);
    assert.ok(item.y > y0, '下に落ちる');
  });

  it('確率0なら何も落ちない', () => {
    const s = launched(ONE_BRICK, 0);
    shootAt(s);
    for (let i = 0; i < 20; i++) update(s, NO_INPUT, DT, ONE_BRICK);
    assert.equal(s.bricks.length, 1);
    assert.equal(s.powerUps.length, 0);
  });

  it('パドルで取ると発動して消える', () => {
    const s = launched();
    catchPowerUp(s, 'pierce');
    assert.equal(s.powerUps.length, 0);
    assert.ok(s.effects.pierce > 0);
    assert.ok(s.events.includes('powerUp'));
  });

  it('取り逃すと画面外で消え、効果は出ない', () => {
    const s = launched();
    s.paddle.x = 0;
    s.powerUps.push({ kind: 'wide', x: WIDTH - 60, y: HEIGHT - 30, w: POWERUP_WIDTH, h: POWERUP_HEIGHT });
    Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -1 });
    for (let i = 0; i < 30; i++) update(s, input({ pointerX: 50 }), DT, ONE_BRICK);
    assert.equal(s.powerUps.length, 0);
    assert.equal(s.effects.wide, 0);
    assert.equal(s.paddle.w, PADDLE_WIDTH);
  });

  it('同じシードなら同じアイテムが同じ順で出る', () => {
    const run = () => {
      const levels = [['1111111111', '1111111111', '1111111111']];
      const s = createGame(levels, { dropChance: 0.5, seed: 123 });
      update(s, input({ action: true }), DT, levels);
      const kinds: string[] = [];
      for (let i = 0; i < 20; i++) {
        s.powerUps = [];
        shootAt(s, 0);
        for (let t = 0; t < 30 && s.powerUps.length === 0 && s.phase === 'playing'; t++) update(s, NO_INPUT, DT, levels);
        kinds.push(s.powerUps[0]?.kind ?? '-');
      }
      return kinds.join(',');
    };
    const first = run();
    assert.equal(first, run());
    assert.ok(first.split(',').filter((k) => k !== '-').length >= 3, `アイテムが十分に出ていない: ${first}`);
  });

  it('ゲームオーバーから再開しても乱数は続きから (同じ列を繰り返さない) で、確率も引き継ぐ', () => {
    const s = createGame(ONE_BRICK, { dropChance: 0.3, seed: 99 });
    s.phase = 'gameOver';
    const seed = s.seed;
    s.seed = seed + 12345;
    update(s, input({ action: true }), DT, ONE_BRICK);
    assert.equal(s.phase, 'ready');
    assert.equal(s.seed, seed + 12345);
    assert.equal(s.dropChance, 0.3);
  });
});

describe('W: パドル拡大', () => {
  it('中心を保ったまま 1.5 倍になり、時間切れで元に戻る', () => {
    const s = launched();
    const center = s.paddle.x + s.paddle.w / 2;
    catchPowerUp(s, 'wide');
    assert.equal(s.paddle.w, PADDLE_WIDTH * WIDE_SCALE);
    assert.ok(Math.abs(s.paddle.x + s.paddle.w / 2 - center) < 1e-9);
    s.balls[0]!.vy = -1;
    for (let t = 0; t < WIDE_DURATION + 0.5; t += 0.05) {
      Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -1 });
      update(s, input({ pointerX: center }), 0.05, ONE_BRICK);
    }
    assert.equal(s.effects.wide, 0);
    assert.equal(s.paddle.w, PADDLE_WIDTH);
  });

  it('画面端で拡大しても画面からはみ出さない', () => {
    const s = launched();
    s.paddle.x = WIDTH - s.paddle.w;
    applyPowerUp(s, 'wide');
    assert.equal(s.paddle.x + s.paddle.w, WIDTH);
  });

  it('効果中にもう一度取ると残り時間に加算され (上限は2回分)、幅はそれ以上大きくならない', () => {
    const s = launched();
    applyPowerUp(s, 'wide');
    s.effects.wide = 10;
    applyPowerUp(s, 'wide');
    assert.equal(s.effects.wide, 10 + WIDE_DURATION);
    applyPowerUp(s, 'wide');
    assert.equal(s.effects.wide, WIDE_DURATION * 2);
    assert.equal(s.paddle.w, PADDLE_WIDTH * WIDE_SCALE);
  });
});

describe('M: マルチボール', () => {
  it('ボールが3つに分かれ、どれも同じ速さで上向きを保つ', () => {
    const s = launched();
    Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -s.speed });
    applyPowerUp(s, 'multi');
    assert.equal(s.balls.length, 3);
    for (const b of s.balls) {
      assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - s.speed) < 1e-6);
      assert.ok(b.vy < 0);
    }
    assert.ok(new Set(s.balls.map((b) => b.vx.toFixed(3))).size === 3, '向きがばらける');
  });

  it('ブロックに接した状態で分裂しても、重なったボールで同じブロックを何度も削らない', () => {
    const levels = [['....3....1']];
    const s = launched(levels);
    const brick = s.bricks[0]!;
    // ブロック下辺に接して上向きに進んでいるボール
    Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + s.balls[0]!.r - 1, vx: 0, vy: -s.speed });
    applyPowerUp(s, 'multi');
    const speed = s.speed;
    update(s, NO_INPUT, DT, levels);
    assert.equal(brick.hp, 2, '1フレームで削れるのは1だけ');
    assert.ok(s.speed <= speed + 3 + 1e-9, '加速も1回分だけ');
  });

  it('重なった2つのボールが同じフレームで当たっても、ひびもダメージも1回分', () => {
    const levels = [['....2....1']];
    const s = launched(levels);
    const brick = s.bricks[0]!;
    const base = { y: brick.y + brick.h + s.balls[0]!.r - 1, vx: 0, vy: -s.speed, r: s.balls[0]!.r };
    s.balls = [
      { ...base, x: brick.x + 30 },
      { ...base, x: brick.x + 31 },
    ];
    update(s, NO_INPUT, DT, levels);
    assert.equal(brick.hp, 1);
    assert.equal(brick.impacts.length, 1);
    assert.deepEqual(s.events.filter((e) => e.startsWith('brick')), ['brickHit']);
  });

  it('続けて取っても、位置も向きも完全に同じボールは生まれない', () => {
    const s = launched();
    Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -s.speed });
    applyPowerUp(s, 'multi');
    applyPowerUp(s, 'multi');
    const key = (b: { vx: number; vy: number }) => `${b.vx.toFixed(2)},${b.vy.toFixed(2)}`;
    assert.equal(new Set(s.balls.map(key)).size, s.balls.length, `重複: ${s.balls.map(key).join(' / ')}`);
  });

  it('水平に近いボールを分裂させても、元と同じ上下方向で十分な縦成分を持つ', () => {
    const s = launched();
    const a = (72.5 * Math.PI) / 180;
    Object.assign(s.balls[0]!, { x: 400, y: 300, vx: Math.sin(a) * s.speed, vy: -Math.cos(a) * s.speed });
    applyPowerUp(s, 'multi');
    for (const b of s.balls.slice(1)) {
      assert.ok(b.vy < 0, `上向きのボールから下向きの子ができた: vy=${b.vy}`);
      assert.ok(Math.abs(b.vy) >= s.speed * 0.5 - 1e-9, `水平に近すぎる: vy=${b.vy}`);
      assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - s.speed) < 1e-6);
    }
  });

  it(`何度取っても最大 ${MAX_BALLS} 個まで`, () => {
    const s = launched();
    for (let i = 0; i < 5; i++) {
      applyPowerUp(s, 'multi');
      // 実際のプレイのように、次に取るまでにボール同士は離れている
      s.balls.forEach((b, j) => Object.assign(b, { x: 40 + j * 60, y: 300 }));
    }
    assert.equal(s.balls.length, MAX_BALLS);
  });

  it('1つ落としてもミスにならず、全部落とすとミス', () => {
    const s = launched();
    applyPowerUp(s, 'multi');
    s.paddle.x = WIDTH - s.paddle.w;
    // 1個だけ画面下へ
    Object.assign(s.balls[0]!, { x: 10, y: HEIGHT - 5, vx: 0, vy: 400 });
    Object.assign(s.balls[1]!, { x: 200, y: 300, vx: 0, vy: -100 });
    Object.assign(s.balls[2]!, { x: 300, y: 300, vx: 0, vy: -100 });
    for (let i = 0; i < 10; i++) update(s, input({ pointerX: WIDTH }), DT, ONE_BRICK);
    assert.equal(s.balls.length, 2);
    assert.equal(s.lives, INITIAL_LIVES);
    assert.equal(s.phase, 'playing');
    // 残りも落とす
    for (const b of s.balls) Object.assign(b, { x: 10, y: HEIGHT - 5, vx: 0, vy: 400 });
    for (let i = 0; i < 10 && s.phase === 'playing'; i++) update(s, input({ pointerX: WIDTH }), DT, ONE_BRICK);
    assert.equal(s.lives, INITIAL_LIVES - 1);
    assert.equal(s.phase, 'ready');
    assert.equal(s.balls.length, 1, '待機中はボール1個に戻る');
  });
});

describe('P: 貫通', () => {
  it('耐久3のブロックも一撃で壊し、跳ね返らずに進む', () => {
    const levels = [['....3....1', '....3.....', '....3.....']];
    const s = launched(levels);
    applyPowerUp(s, 'pierce');
    const col = s.bricks.filter((b) => b.x === s.bricks[0]!.x);
    const bottom = col[col.length - 1]!;
    Object.assign(s.balls[0]!, { x: bottom.x + bottom.w / 2, y: bottom.y + bottom.h + 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 40; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.bricks.length, 1, '縦に並んだ3個を1回で貫く');
    assert.ok(s.score >= 3 * (10 + 40 * 3));
  });

  it('貫通で割ったブロックも破片用に記録され、向きはボールの進む向きのまま (ひびは記録しない)', () => {
    const levels = [['....3....1']];
    const s = launched(levels);
    applyPowerUp(s, 'pierce');
    const brick = s.bricks[0]!;
    Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 50, vy: -300 });
    for (let i = 0; i < 20 && s.broken.length === 0; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.broken.length, 1);
    assert.deepEqual([s.broken[0]!.vx, s.broken[0]!.vy], [50, -300]);
    assert.deepEqual([s.balls[0]!.vx, s.balls[0]!.vy], [50, -300], 'ボールも曲がらない');
    assert.equal(brick.impacts.length, 0);
  });

  it(`${PIERCE_DURATION}秒で切れ、その後は普通に跳ね返る`, () => {
    const levels = [['....2....1']];
    const s = launched(levels);
    applyPowerUp(s, 'pierce');
    for (let t = 0; t < PIERCE_DURATION + 0.1; t += 0.05) {
      Object.assign(s.balls[0]!, { x: 400, y: 300, vx: 0, vy: -1 });
      update(s, input({ pointerX: 400 }), 0.05, levels);
    }
    assert.equal(s.effects.pierce, 0);
    shootAt(s);
    for (let i = 0; i < 20 && s.balls[0]!.vy < 0; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.bricks.length, 2, '耐久2は1回では壊れない');
    assert.ok(s.balls[0]!.vy > 0);
  });
});

describe('リセット', () => {
  it('ミスすると効果・アイテム・ボールが初期状態に戻る', () => {
    const s = launched();
    applyPowerUp(s, 'wide');
    applyPowerUp(s, 'pierce');
    applyPowerUp(s, 'multi');
    s.powerUps.push({ kind: 'multi', x: 100, y: 100, w: POWERUP_WIDTH, h: POWERUP_HEIGHT });
    for (const b of s.balls) Object.assign(b, { x: 10, y: HEIGHT - 5, vx: 0, vy: 400 });
    s.paddle.x = WIDTH - s.paddle.w;
    for (let i = 0; i < 10 && s.phase === 'playing'; i++) update(s, input({ pointerX: WIDTH }), DT, ONE_BRICK);
    assert.equal(s.phase, 'ready');
    assert.deepEqual(s.effects, { wide: 0, pierce: 0 });
    assert.equal(s.powerUps.length, 0);
    assert.equal(s.balls.length, 1);
    assert.equal(s.paddle.w, PADDLE_WIDTH);
  });

  it('ステージクリアで次のステージは素の状態から始まる', () => {
    const levels = [['....1.....'], ['....1.....']];
    const s = launched(levels);
    applyPowerUp(s, 'wide');
    applyPowerUp(s, 'multi');
    shootAt(s);
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.phase, 'levelClear');
    update(s, input({ action: true }), DT, levels);
    assert.equal(s.level, 1);
    assert.equal(s.balls.length, 1);
    assert.equal(s.paddle.w, PADDLE_WIDTH);
    assert.deepEqual(s.effects, { wide: 0, pierce: 0 });
  });

  it('クリアした瞬間に効果と余分なボールが消え、クリア画面に残らない', () => {
    const levels = [['....1.....'], ['....1.....']];
    const s = launched(levels);
    applyPowerUp(s, 'wide');
    applyPowerUp(s, 'pierce');
    applyPowerUp(s, 'multi');
    shootAt(s);
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.phase, 'levelClear');
    assert.deepEqual(s.effects, { wide: 0, pierce: 0 });
    assert.equal(s.paddle.w, PADDLE_WIDTH);
    assert.equal(s.balls.length, 1);
  });
});

describe('通しプレイ (アイテムあり)', () => {
  it('アイテムが出る設定でも自動操縦で全ステージをクリアでき、ボールは画面内にある', () => {
    const s = createGame(LEVELS, { seed: 42 });
    let t = 0;
    let caught = 0;
    while (s.phase !== 'won' && t < 60 * 30) {
      // 一番低い (パドルに近い) 下向きのボールを追う
      const target = [...s.balls].sort((a, b) => (b.vy > 0 ? b.y : -1) - (a.vy > 0 ? a.y : -1))[0]!;
      const aim = target.x + Math.sin(t * 0.7) * s.paddle.w * 0.35;
      const act = s.phase === 'ready' || s.phase === 'levelClear';
      update(s, input({ pointerX: aim, action: act }), DT);
      if (s.events.includes('powerUp')) caught++;
      assert.notEqual(s.phase, 'gameOver');
      for (const b of s.balls) {
        assert.ok(b.x >= 0 && b.x <= WIDTH && b.y >= 0, `ボールが画面外: ${b.x},${b.y}`);
      }
      t += DT;
    }
    assert.equal(s.phase, 'won', `30分以内にクリアできなかった (stage ${s.level + 1}, 残り ${s.bricks.length})`);
    assert.ok(caught > 0, 'アイテムを1つは取っている');
  });
});
