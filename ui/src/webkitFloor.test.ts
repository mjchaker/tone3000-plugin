import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The system WebKit floor is Safari 13.1 (vite.config.ts). CSS it doesn't
// know isn't a parse error, just a silently dropped declaration, so nothing
// else catches it. `inset` is Safari 14.1+: use INSET_0 from theme.ts.
// (Flex `gap`, also 14.1+, is rebuilt at runtime by flexGapShim.ts.)

const SRC = join(__dirname);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

describe('Safari 13.1 floor', () => {
  it('uses no `inset` shorthand', () => {
    const hits: string[] = [];
    for (const file of sources(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!isComment(line) && /(^|[\s{;,])inset\s*:/.test(line))
            hits.push(`${file.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
