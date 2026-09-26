import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HEIGHT, INITIAL_LIVES, WIDTH } from '../../src/game/constants.ts';
import { createGame, update } from '../../src/game/game.ts';
import { LEVELS } from '../../src/game/levels.ts';
import { NO_INPUT, type Brick, type GameState, type Input } from '../../src/game/types.ts';

const DT = 1 / 120;
const input = (patch: Partial<Input> = {}): Input => ({ ...NO_INPUT, ...patch });

/** ブロック1個だけのステージ (ボールの真上、中央付近) */
const ONE_BRICK = [['....1.....']];
const TWO_STAGES = [['....1.....'], ['....1.....']];

/** 既存の挙動を確かめるテストではアイテムを落とさない */
const NO_DROP = { dropChance: 0, seed: 1 };

function launched(levels = LEVELS, options = NO_DROP): GameState {
  const s = createGame(levels, options);
  update(s, input({ action: true }), DT, levels);
  return s;
}

describe('開始と発射', () => {
  it('初期状態: 待機中・ライフ3・ボールはパドルの上', () => {
    const s = createGame(LEVELS, NO_DROP);
    assert.equal(s.phase, 'ready');
    assert.equal(s.lives, INITIAL_LIVES);
    assert.equal(s.score, 0);
    assert.equal(s.balls[0]!.x, s.paddle.x + s.paddle.w / 2);
    assert.equal(s.balls[0]!.y, s.paddle.y - s.balls[0]!.r);
  });

  it('待機中はボールがパドルについてくる', () => {
    const s = createGame(LEVELS, NO_DROP);
    update(s, input({ pointerX: 200 }), DT);
    assert.equal(s.balls[0]!.x, 200);
  });

  it('発射すると上向きに飛ぶ', () => {
    const s = launched();
    assert.equal(s.phase, 'playing');
    assert.ok(s.balls[0]!.vy < 0);
    assert.ok(s.events.includes('launch'));
  });
});

describe('パドル操作', () => {
  it('キーボードで動き、画面端で止まる', () => {
    const s = createGame(LEVELS, NO_DROP);
    const x0 = s.paddle.x;
    update(s, input({ right: true }), 0.1);
    assert.ok(s.paddle.x > x0);
    for (let i = 0; i < 100; i++) update(s, input({ left: true }), 0.1);
    assert.equal(s.paddle.x, 0);
    for (let i = 0; i < 100; i++) update(s, input({ right: true }), 0.1);
    assert.equal(s.paddle.x, WIDTH - s.paddle.w);
  });

  it('ポインタ位置にパドルの中心が合う', () => {
    const s = createGame(LEVELS, NO_DROP);
    update(s, input({ pointerX: 300 }), DT);
    assert.equal(s.paddle.x + s.paddle.w / 2, 300);
  });
});

describe('反射とブロック', () => {
  it('天井で跳ね返る', () => {
    const s = launched(ONE_BRICK);
    Object.assign(s.balls[0]!, { x: 100, y: 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 10; i++) update(s, NO_INPUT, DT, ONE_BRICK);
    assert.ok(s.balls[0]!.vy > 0);
    assert.ok(s.balls[0]!.y - s.balls[0]!.r >= 0);
  });

  it('耐久2のブロックは1回目で欠け、2回目で壊れて得点が入る', () => {
    const levels = [['....2....1']];
    const s = launched(levels);
    const brick = s.bricks[0]!;
    const shoot = () => {
      Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
      s.events = [];
      for (let i = 0; i < 20 &&!s.events.some((e) => e.startsWith('brick')); i++) update(s, NO_INPUT, DT, levels);
    };
    shoot();
    assert.equal(brick.hp, 1);
    assert.equal(s.score, 10);
    assert.ok(s.balls[0]!.vy > 0, 'ブロックで下向きに跳ね返る');
    shoot();
    assert.equal(s.bricks.length, 1, '壊れたブロックは消える');
    assert.equal(s.score, 10 + 10 + 80);
  });

  it('角をかすめても、1回の接触で削れる耐久値は1だけ', () => {
    const levels = [['...3......']];
    for (let deg = -80; deg <= 80; deg += 2) {
      for (let off = -12; off <= 12; off += 1) {
        const s = launched(levels);
        const brick = s.bricks[0]!;
        const a = (deg * Math.PI) / 180;
        // ブロック下辺の左端付近 (off = 0 が左下の角) を狙って撃つ
        const tx = brick.x + off;
        const ty = brick.y + brick.h;
        Object.assign(s.balls[0]!, {
          x: tx - Math.sin(a) * 60,
          y: ty + Math.cos(a) * 60,
          vx: Math.sin(a) * s.speed,
          vy: -Math.cos(a) * s.speed,
        });
        let first = -1;
        let hits = 0;
        for (let i = 0; i < 40 && s.phase === 'playing'; i++) {
          update(s, NO_INPUT, DT, levels);
          const h = s.events.filter((e) => e.startsWith('brick')).length;
          if (h && first < 0) first = i;
          if (h && i - first <= 3) hits += h;
        }
        assert.ok(hits <= 1, `deg=${deg} off=${off} で ${hits} 回連続で当たった`);
      }
    }
  });

  it('2つのブロックの継ぎ目に当たっても、削れるのは1個だけで跳ね返る', () => {
    const levels = [['...11.....']];
    const s = launched(levels);
    const [a, b] = s.bricks as [Brick, Brick];
    const seam = (a.x + a.w + b.x) / 2;
    Object.assign(s.balls[0]!, { x: seam, y: a.y + a.h + 30, vx: 0, vy: -s.speed });
    for (let i = 0; i < 30 && s.balls[0]!.vy < 0; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.bricks.length, 1);
    assert.ok(s.balls[0]!.vy > 0);
    for (let i = 0; i < 10; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(s.bricks.length, 1, '跳ね返った後にもう1個を削らない');
  });

  it('当たるたびに、ブロック上の当たった点がひびの起点として記録される', () => {
    const levels = [['....3....1']];
    const s = launched(levels);
    const brick = s.bricks[0]!;
    Object.assign(s.balls[0]!, { x: brick.x + 20, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 20 && brick.impacts.length === 0; i++) update(s, NO_INPUT, DT, levels);
    assert.equal(brick.impacts.length, 1);
    const hit = brick.impacts[0]!;
    assert.ok(Math.abs(hit.x - 20) < 1, `下辺の、左から 20px の点: ${hit.x}`);
    assert.ok(Math.abs(hit.y - brick.h) < 1e-6);
  });

  it('割れたブロックは、割ったボールの速度つきで broken に1フレームだけ載る', () => {
    const s = launched(ONE_BRICK);
    const brick = s.bricks[0]!;
    Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
    for (let i = 0; i < 20 && s.broken.length === 0; i++) update(s, NO_INPUT, DT, ONE_BRICK);
    assert.equal(s.broken.length, 1);
    assert.deepEqual({ x: s.broken[0]!.x, y: s.broken[0]!.y }, { x: brick.x, y: brick.y });
    // 破片はボールが跳ね返った向きではなく、ぶつかってきた向き (ガラスを押し抜く向き) に飛ぶ
    assert.ok(s.broken[0]!.vy < 0, `下から上へ割ったので上向き: ${s.broken[0]!.vy}`);
    assert.ok(s.balls[0]!.vy > 0, 'ボール自体は跳ね返って下向き');
    update(s, NO_INPUT, DT, ONE_BRICK);
    assert.equal(s.broken.length, 0, '次のフレームでは空');
  });

  it('大きな dt でもブロックをすり抜けない', () => {
    const s = launched(ONE_BRICK);
    const brick = s.bricks[0]!;
    s.speed = 720;
    Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + 200, vx: 0, vy: -720 });
    update(s, NO_INPUT, 0.25, ONE_BRICK);
    assert.notEqual(s.phase, 'playing', '当たって全消し → クリアになる');
  });
});

describe('パドル', () => {
  it('上から当たると打ち返す', () => {
    const s = launched(ONE_BRICK);
    const p = s.paddle;
    Object.assign(s.balls[0]!, { x: p.x + p.w / 2, y: p.y - 30, vx: 0, vy: s.speed });
    for (let i = 0; i < 20 && s.balls[0]!.vy > 0; i++) update(s, input({ pointerX: p.x + p.w / 2 }), DT, ONE_BRICK);
    assert.ok(s.balls[0]!.vy < 0);
    assert.ok(s.events.includes('paddle'));
  });

  it('端では曲面に沿って低い位置で打ち返す (空中で跳ね返らない)', () => {
    const s = launched(ONE_BRICK);
    const p = s.paddle;
    const edgeX = p.x + 4;
    Object.assign(s.balls[0]!, { x: edgeX, y: p.y - 40, vx: 0, vy: s.speed });
    let lowest = 0;
    for (let i = 0; i < 40 && s.balls[0]!.vy > 0; i++) {
      update(s, input({ pointerX: p.x + p.w / 2 }), DT, ONE_BRICK);
      lowest = Math.max(lowest, s.balls[0]!.y);
    }
    assert.ok(s.balls[0]!.vy < 0, '打ち返している');
    assert.ok(lowest > p.y - s.balls[0]!.r + 10, `平らな上面 (${p.y - s.balls[0]!.r}) より下まで来てから跳ね返る: ${lowest}`);
  });

  it('上面より下に来たボールは、パドルを横から寄せても拾えない', () => {
    const s = launched(ONE_BRICK);
    const p = s.paddle;
    Object.assign(s.balls[0]!, { x: 100, y: p.y + p.h / 2, vx: 0, vy: s.speed });
    // パドルの右端がボールに重なる位置へ瞬間移動
    update(s, input({ pointerX: 100 - p.w / 2 + 2 }), DT, ONE_BRICK);
    assert.ok(s.balls[0]!.vy > 0, '下向きのまま');
    assert.ok(!s.events.includes('paddle'));
  });
});

describe('ライフとゲームオーバー', () => {
  const drop = (s: GameState) => {
    Object.assign(s.balls[0]!, { x: 10, y: HEIGHT - 5, vx: 0, vy: 400 });
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
    Object.assign(s.balls[0]!, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 20, vx: 0, vy: -s.speed });
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
    const { x, y } = s.balls[0]!;
    for (let i = 0; i < 10; i++) update(s, NO_INPUT, DT);
    assert.deepEqual({ x: s.balls[0]!.x, y: s.balls[0]!.y }, { x, y });
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'playing');
  });

  it('プレイ中以外 (待機・クリア・ゲームオーバー) では一時停止しない', () => {
    const s = createGame(LEVELS, NO_DROP);
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'ready');
    s.phase = 'levelClear';
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'levelClear');
    s.phase = 'gameOver';
    update(s, input({ pause: true }), DT);
    assert.equal(s.phase, 'gameOver');
  });
});

describe('通しプレイ', () => {
  it('ボールを追いかける自動操縦で全ステージをクリアでき、ボールは常に画面内にある', () => {
    const s = createGame(LEVELS, NO_DROP);
    let t = 0;
    // パドルの当たり位置を少しずつずらして角度を変え、同じ軌道の往復を避ける
    while (s.phase !== 'won' && t < 60 * 30) {
      const aim = s.balls[0]!.x + Math.sin(t * 0.7) * s.paddle.w * 0.35;
      const act = s.phase === 'ready' || s.phase === 'levelClear';
      update(s, input({ pointerX: aim, action: act }), DT);
      assert.notEqual(s.phase, 'gameOver');
      assert.ok(s.balls[0]!.x >= 0 && s.balls[0]!.x <= WIDTH && s.balls[0]!.y >= 0, `ボールが画面外: ${s.balls[0]!.x},${s.balls[0]!.y}`);
      t += DT;
    }
    assert.equal(s.phase, 'won', `30分以内にクリアできなかった (stage ${s.level + 1}, 残り ${s.bricks.length})`);
  });
});
