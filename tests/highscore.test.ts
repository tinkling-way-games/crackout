import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HIGH_SCORE_KEY, MAX_ENTRIES, insertScore, loadScores, saveScores, type ScoreEntry } from '../src/highscore.ts';

const entry = (score: number, stage = 1, date = '2026-09-26'): ScoreEntry => ({ score, stage, date });

/** localStorage の代わり */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('insertScore (ランキングへの記録)', () => {
  it('高い順に並べ、今回の順位 (0 始まり) を返す', () => {
    const { list, rank } = insertScore([entry(500), entry(100)], entry(300));
    assert.deepEqual(list.map((e) => e.score), [500, 300, 100]);
    assert.equal(rank, 1);
  });

  it(`上位 ${MAX_ENTRIES} 件だけ残し、圏外なら順位は null`, () => {
    const full = [900, 800, 700, 600, 500].map((s) => entry(s));
    const out = insertScore(full, entry(100));
    assert.equal(out.rank, null);
    assert.equal(out.list.length, MAX_ENTRIES);
    const top = insertScore(full, entry(1000));
    assert.equal(top.rank, 0);
    assert.deepEqual(top.list.map((e) => e.score), [1000, 900, 800, 700, 600]);
  });

  it('同点なら先に出した記録が上 (後から同点を出しても抜けない)', () => {
    const { list, rank } = insertScore([entry(500, 1, 'old')], entry(500, 2, 'new'));
    assert.deepEqual(list.map((e) => e.date), ['old', 'new']);
    assert.equal(rank, 1);
  });

  it('0点は記録しない', () => {
    const { list, rank } = insertScore([], entry(0));
    assert.equal(list.length, 0);
    assert.equal(rank, null);
  });

  it('元の配列は書き換えない', () => {
    const before = [entry(500)];
    insertScore(before, entry(900));
    assert.equal(before.length, 1);
  });
});

describe('loadScores / saveScores (保存)', () => {
  it('保存したものを読み戻せる', () => {
    const storage = memoryStorage();
    saveScores(storage, [entry(500, 3), entry(100)]);
    assert.deepEqual(loadScores(storage), [entry(500, 3), entry(100)]);
  });

  it('何も保存されていなければ空', () => {
    assert.deepEqual(loadScores(memoryStorage()), []);
  });

  it('壊れたデータ・形の違うデータは無視する (不正な項目だけ捨てる)', () => {
    assert.deepEqual(loadScores(memoryStorage({ [HIGH_SCORE_KEY]: '{not json' })), []);
    assert.deepEqual(loadScores(memoryStorage({ [HIGH_SCORE_KEY]: '{"a":1}' })), []);
    const mixed = JSON.stringify([entry(500), { score: 'x' }, null, entry(-5), entry(300), { score: 200 }]);
    assert.deepEqual(loadScores(memoryStorage({ [HIGH_SCORE_KEY]: mixed })), [entry(500), entry(300)]);
  });

  it('保存されたデータの並びが崩れていても、高い順・上限件数にそろえる', () => {
    const messy = JSON.stringify([100, 900, 300, 700, 500, 800, 200].map((s) => entry(s)));
    const list = loadScores(memoryStorage({ [HIGH_SCORE_KEY]: messy }));
    assert.deepEqual(list.map((e) => e.score), [900, 800, 700, 500, 300]);
  });

  it('ストレージが使えなくても例外を出さない (プライベートブラウズなど)', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    assert.deepEqual(loadScores(broken), []);
    assert.doesNotThrow(() => saveScores(broken, [entry(100)]));
    assert.deepEqual(loadScores(null), []);
    assert.doesNotThrow(() => saveScores(null, [entry(100)]));
  });
});
