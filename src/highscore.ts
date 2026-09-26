/**
 * ハイスコア (上位 MAX_ENTRIES 件のランキング)。
 * 保存先は localStorage だが、テストで差し替えられるよう getItem / setItem を持つものなら何でもよい。
 */
export interface ScoreEntry {
  score: number;
  /** 到達したステージ (1 始まり) */
  stage: number;
  /** 記録した日 (YYYY-MM-DD) */
  date: string;
}

export type ScoreStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const HIGH_SCORE_KEY = 'breakout.highScores';
export const MAX_ENTRIES = 5;

/**
 * ランキングに記録する。元の配列は変えずに新しい配列を返す。
 * 同点なら先に出した記録を上にする。
 * @returns rank 今回の順位 (0 = 1位)。圏外や0点なら null
 */
export function insertScore(list: readonly ScoreEntry[], entry: ScoreEntry): { list: ScoreEntry[]; rank: number | null } {
  // 渡されたものが上限を超えていても、返すのは常に上限件数まで
  const top = list.slice(0, MAX_ENTRIES);
  if (entry.score <= 0) return { list: top, rank: null };
  let at = top.findIndex((e) => e.score < entry.score);
  if (at === -1) at = top.length;
  if (at >= MAX_ENTRIES) return { list: top, rank: null };
  const next = [...top.slice(0, at), entry, ...top.slice(at)].slice(0, MAX_ENTRIES);
  return { list: next, rank: at };
}

const isEntry = (v: unknown): v is ScoreEntry => {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.score === 'number' &&
    Number.isFinite(e.score) &&
    e.score > 0 &&
    // 到達ステージは 1 始まりの整数 (NaN・無限大・0・負数・小数は壊れたデータとして捨てる)
    typeof e.stage === 'number' &&
    Number.isInteger(e.stage) &&
    e.stage >= 1 &&
    typeof e.date === 'string'
  );
};

/** 保存されたランキングを読む。無い・壊れている・読めないときは空 (ゲームは止めない) */
export function loadScores(storage: ScoreStorage | null): ScoreEntry[] {
  try {
    const raw = storage?.getItem(HIGH_SCORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isEntry)
      .map(({ score, stage, date }) => ({ score, stage, date }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** ランキングを保存する。書けなくても (容量超過・プライベートブラウズ) 例外は出さない */
export function saveScores(storage: ScoreStorage | null, list: readonly ScoreEntry[]): void {
  try {
    storage?.setItem(HIGH_SCORE_KEY, JSON.stringify(list));
  } catch {
    // 保存できないだけでゲームは続けられるので無視する
  }
}

/** 今日の日付 (ローカル時刻の YYYY-MM-DD) */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
