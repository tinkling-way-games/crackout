// ゲーム内の論理座標系 (px)。描画時に実画面サイズへ拡大縮小する。
export const WIDTH = 800;
export const HEIGHT = 600;

export const PADDLE_WIDTH = 110;
export const PADDLE_HEIGHT = 14;
export const PADDLE_Y = HEIGHT - 40;
/** キーボード操作時のパドル速度 (px/s) */
export const PADDLE_SPEED = 620;

export const BALL_RADIUS = 8;
/** ステージ1開始時のボール速度 (px/s)。ステージごとに BALL_SPEED_PER_LEVEL ずつ上がる */
export const BALL_SPEED = 360;
export const BALL_SPEED_PER_LEVEL = 40;
/** ブロックに当たるたびに上がる速度 */
export const BALL_SPEEDUP_PER_HIT = 3;
export const BALL_MAX_SPEED = 720;
/** パドルの端で打ったときの、真上からの最大角度 (ラジアン) */
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
/** 静止状態で発射したときの角度。真上だとパドル中央で往復し続けるので少し傾ける */
export const LAUNCH_ANGLE = (12 * Math.PI) / 180;

export const BRICK_COLS = 10;
export const BRICK_HEIGHT = 24;
export const BRICK_GAP = 4;
export const BRICK_TOP = 80;
export const BRICK_SIDE = 20;
export const BRICK_WIDTH = (WIDTH - BRICK_SIDE * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;

export const INITIAL_LIVES = 3;
/** ブロックに1回当てるごとの得点 */
export const SCORE_PER_HIT = 10;
/** ブロックを壊したときのボーナス (耐久値 × この値) */
export const SCORE_BREAK_BONUS = 40;

// パワーアップ
/** ブロックを壊したときにアイテムが落ちる確率 */
export const POWERUP_DROP_CHANCE = 0.18;
export const POWERUP_FALL_SPEED = 160;
export const POWERUP_WIDTH = 44;
export const POWERUP_HEIGHT = 18;
/** W: パドル拡大の倍率と持続時間 (秒) */
export const WIDE_SCALE = 1.5;
export const WIDE_DURATION = 15;
/** P: 貫通の持続時間 (秒) */
export const PIERCE_DURATION = 8;
/** M: 分裂したボールを元の向きから何度ずらすか */
export const MULTI_SPREAD = (20 * Math.PI) / 180;
export const MAX_BALLS = 12;
