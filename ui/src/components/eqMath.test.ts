import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EqBand } from '../types/chain';
import { eqResponseDb, formatFreq, freqToNorm, normToFreq } from './eqMath';

// The drawn EQ curve claims to be the audio truth, so it is pinned to the same
// golden file the native BlockEqGoldenTest measures the real filter against
// (test/src/block_eq_tests.cpp). A drift on either side fails its own suite.
const GOLDEN_PATH = fileURLToPath(
  new URL('../../../test/files/eq_response_golden.json', import.meta.url)
);

interface GoldenCase {
  name: string;
  sampleRate: number;
  bands: EqBand[];
  probesHz: number[];
  expectedDb: number[];
}

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as {
  about: string;
  cases: GoldenCase[];
};

// Regenerate on an intentional change to the EQ math. Rounded so the file
// diffs cleanly; far below the native test's measurement tolerance.
if (process.env.UPDATE_EQ_GOLDEN === '1') {
  for (const c of golden.cases) {
    c.expectedDb = eqResponseDb(c.bands, c.sampleRate, c.probesHz).map(
      (db) => Math.round(db * 1e6) / 1e6
    );
  }
  writeFileSync(GOLDEN_PATH, `${JSON.stringify(golden, null, 2)}\n`);
}

describe('eqResponseDb matches the shared golden', () => {
  it.each(golden.cases.map((c) => [c.name, c] as const))('%s', (_, c) => {
    expect(c.expectedDb).toHaveLength(c.probesHz.length);
    const actual = eqResponseDb(c.bands, c.sampleRate, c.probesHz);
    actual.forEach((db, i) => {
      expect(db, `${c.probesHz[i]} Hz`).toBeCloseTo(c.expectedDb[i], 5);
    });
  });
});

describe('eqResponseDb', () => {
  it('is 0 dB everywhere with no active bands', () => {
    expect(eqResponseDb([], 48000, [20, 1000, 20000])).toEqual([0, 0, 0]);
  });

  it('peaks at the bell centre with the requested gain', () => {
    const bell: EqBand = { type: 'bell', freqHz: 1000, gainDb: 9, q: 2 };
    const [atCentre] = eqResponseDb([bell], 48000, [1000]);
    expect(atCentre).toBeCloseTo(9, 6);
  });

  it('puts a cut filter 3 dB down at its corner when Q is 1/sqrt(2)', () => {
    const lowcut: EqBand = { type: 'lowcut', freqHz: 200, gainDb: 0, q: Math.SQRT1_2 };
    const [atCorner] = eqResponseDb([lowcut], 48000, [200]);
    expect(atCorner).toBeCloseTo(-3.0103, 3);
  });
});

describe('frequency axis', () => {
  it('maps the audible range onto 0..1 and back', () => {
    expect(freqToNorm(20)).toBe(0);
    expect(freqToNorm(20000)).toBeCloseTo(1, 12);
    for (const f of [20, 63, 440, 1000, 7777, 20000]) {
      expect(normToFreq(freqToNorm(f))).toBeCloseTo(f, 6);
    }
  });

  it('clamps outside the audible range', () => {
    expect(freqToNorm(5)).toBe(0);
    expect(freqToNorm(40000)).toBe(1);
    expect(normToFreq(-1)).toBeCloseTo(20, 9);
    expect(normToFreq(2)).toBeCloseTo(20000, 6);
  });

  it('formats readouts by decade', () => {
    expect(formatFreq(251.4)).toBe('251 Hz');
    expect(formatFreq(1600)).toBe('1.60k');
    expect(formatFreq(12500)).toBe('12.5k');
  });
});
