import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HEIGHT, INITIAL_LIVES, WIDTH } from '../../src/game/constants.ts';
import { createGame, update } from '../../src/game/game.ts';
import { LEVELS } from '../../src/game/levels.ts';
import { NO_INPUT, type GameState, type Input } from '../../src/game/types.ts';

const DT = 1 / 120;
const input = (patch: Partial<Input> = {}): Input => ({ ...NO_INPUT, ...patch });

/** ブロック1個だけのステージ (ボールの真上、中央付近) */
const ONE_BRICK = [['....1.....']];
const TWO_STAGES = [['....1.....'], ['....1.....']];

function launched(levels = LEVELS): GameState {
  const s = createGame(levels);
  update(s, input({ action: true }), DT, levels);
  return s;
}

describe('開始と発射', () => {
  it('初期状態: 待機中・ライフ3・ボールはパドルの上', () => {
    const s = createGame();
    assert.equal(s.phase, 'ready');
    assert.equal(s.lives, INITIAL_LIVES);
    assert.equal(s.score, 0);
    assert.equal(s.ball.x, s.paddle.x + s.paddle.w / 2);
    assert.equal(s.ball.y, s.paddle.y - s.ball.r);
  });

  it('待機中はボールがパドルについてくる', () => {
    const s = createGame();
    update(s, input({ pointerX: 200 }), DT);
    assert.equal(s.ball.x, 200);
  });

  it('発射すると上向きに飛ぶ', () => {
    const s = launched();
    assert.equal(s.phase, 'playing');
    assert.ok(s.ball.vy < 0);
    assert.ok(s.events.includes('launch'));
  });
});

describe('パドル操作', () => {
  it('キーボードで動き、画面端で止まる', () => {
    const s = createGame();
    const x0 = s.paddle.x;
    update(s, input({ right: true }), 0.1);
    assert.ok(s.paddle.x > x0);
    for (let i = 0; i < 100; i++) update(s, input({ left: true }), 0.1);
    assert.equal(s.paddle.x, 0);
    for (let i = 0; i < 100; i++) update(s, input({ right: true }), 0.1);
    assert.equal(s.paddle.x, WIDTH - s.paddle.w);
  });

  it('ポインタ位置にパドルの中心が合う', () => {
    const s = createGame();
    update(s, input({ pointerX: 300 }), DT);
    assert.equal(s.paddle.x + s.paddle.w / 2, 300);
  });
});

describe('反射とブロック', () => {
  it('天井で跳ね返る', () => {
    const s = launched(ONE_BRICK);
    Object.assign(s.ball, { x: 100, y: 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 10; i++) update(s, NO_INPUT, DT, ONE_BRICK);
    assert.ok(s.ball.vy > 0);
    assert.ok(s.ball.y - s.ball.r >= 0);
  });

  it('耐久2のブロックは1回目で欠け、2回目で壊れて得点が入る', () => {
    const levels = [['....2....1']];
    const s = launched(levels);
    const brick = s.bricks[0]!;
    const shoot = () => {
      Object.assign(s.ball, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
      s.events = [];
      for (let i = 0; i < 20 &&!s.events.some((e) => e.startsWith('brick')); i++) update(s, NO_INPUT, DT, levels);
    };
    shoot();
    assert.equal(brick.hp, 1);
    assert.equal(s.score, 10);
    assert.ok(s.ball.vy > 0, 'ブロックで下向きに跳ね返る');
    shoot();
    assert.equal(s.bricks.length, 1, '壊れたブロックは消える');
    assert.equal(s.score, 10 + 10 + 80);
  });

  it('大きな dt でもブロックをすり抜けない', () => {
    const s = launched(ONE_BRICK);
    const brick = s.bricks[0]!;
    s.speed = 720;
    Object.assign(s.ball, { x: brick.x + brick.w / 2, y: brick.y + 200, vx: 0, vy: -720 });
    update(s, NO_INPUT, 0.25, ONE_BRICK);
    assert.notEqual(s.phase, 'playing', '当たって全消し → クリアになる');
  });
});

describe('ライフとゲームオーバー', () => {
  const drop = (s: GameState) => {
    Object.assign(s.ball, { x: 10, y: HEIGHT - 5, vx: 0, vy: 400 });
    s.paddle.x = WIDTH - s.paddle.w;
    for (let i = 0; i < 20 && s.phase === 'playing'; i++) update(s, NO_INPUT, DT, ONE_BRICK);
  };

  it('落とすとライフが減り、待機に戻る', () => {
    const s = launched(ONE_BRICK);
    drop(s);
    assert.equal(s.lives, INITIAL_LIVES - 1);
    assert.equal(s.phase, 'ready');
  });

  it('ライフが尽きるとゲームオーバー、決定ボタンで最初から', () => {
    const s = launched(ONE_BRICK);
    for (let i = 0; i < INITIAL_LIVES; i++) {
      if (s.phase === 'ready') update(s, input({ action: true }), DT, ONE_BRICK);
      drop(s);
    }
    assert.equal(s.phase, 'gameOver');
    update(s, input({ action: true }), DT, ONE_BRICK);
    assert.equal(s.phase, 'ready');
    assert.equal(s.lives, INITIAL_LIVES);
    assert.equal(s.score, 0);
  });
});

describe('ステージ進行', () => {
  const clear = (s: GameState, levels: string[][]) => {
    const brick = s.bricks[0]!;
    Object.assign(s.ball, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 30 && s.phase === 'playing'; i++) update(s, NO_INPUT, DT, levels);
  };

  it('全部壊すと次のステージへ、最後のステージならオールクリア', () => {
    const s = launched(TWO_STAGES);
    clear(s, TWO_STAGES);
    assert.equal(s.phase, 'levelClear');
    update(s, input({ action: true }), DT, TWO_STAGES);
    assert.equal(s.phase, 'ready');
    assert.equal(s.level, 1);
    assert.equal(s.bricks.length, 1);
    update(s, input({ action: true }), DT, TWO_STAGES);
    clear(s, TWO_STAGES);
    assert.equal(s.phase, 'won');
  });
});

describe('一時停止', () => {
  it('停止中はボールが動かず、もう一度押すと再開', () => {
    const s = launched();
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'paused');
    const { x, y } = s.ball;
    for (let i = 0; i < 10; i++) update(s, NO_INPUT, DT);
    assert.deepEqual({ x: s.ball.x, y: s.ball.y }, { x, y });
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'playing');
  });
});

describe('通しプレイ', () => {
  it('ボールを追いかける自動操縦で全ステージをクリアでき、ボールは常に画面内にある', () => {
    const s = createGame();
    let t = 0;
    // パドルの当たり位置を少しずつずらして角度を変え、同じ軌道の往復を避ける
    while (s.phase !== 'won' && t < 60 * 30) {
      const aim = s.ball.x + Math.sin(t * 0.7) * s.paddle.w * 0.35;
      const act = s.phase === 'ready' || s.phase === 'levelClear';
      update(s, input({ pointerX: aim, action: act }), DT);
      assert.notEqual(s.phase, 'gameOver');
      assert.ok(s.ball.x >= 0 && s.ball.x <= WIDTH && s.ball.y >= 0, `ボールが画面外: ${s.ball.x},${s.ball.y}`);
      t += DT;
    }
    assert.equal(s.phase, 'won', `30分以内にクリアできなかった (stage ${s.level + 1}, 残り ${s.bricks.length})`);
  });
});
