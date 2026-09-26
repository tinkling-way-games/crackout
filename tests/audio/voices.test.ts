import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createVoiceLimiter } from '../../src/audio.ts';

describe('createVoiceLimiter (同時に鳴らす金属音の上限)', () => {
  it('上限までは鳴らせて、超えた分は断る', () => {
    const voices = createVoiceLimiter(3);
    assert.equal(voices.tryStart(0, 1.4), true);
    assert.equal(voices.tryStart(0.05, 1.45), true);
    assert.equal(voices.tryStart(0.1, 1.5), true);
    assert.equal(voices.tryStart(0.15, 1.55), false);
  });

  it('鳴り終わった音の分は、音声の時計で空きになる (タイマーに頼らない)', () => {
    const voices = createVoiceLimiter(2);
    voices.tryStart(0, 1.4);
    voices.tryStart(0.1, 1.5);
    assert.equal(voices.tryStart(1.0, 2.4), false, 'まだ2つとも鳴っている');
    assert.equal(voices.tryStart(1.45, 2.85), true, '1つ目が鳴り終わったので空いた');
  });
});
