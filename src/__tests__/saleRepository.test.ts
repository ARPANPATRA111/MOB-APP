import { execFileSync } from 'node:child_process';
import path from 'node:path';
// A real database exercises constraints and rollback that an array-based fake cannot.
it('preserves commerce invariants in real SQLite', () => {
  const output = execFileSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts/test-sqlite.cjs')],
    { encoding: 'utf8', timeout: 30000 }
  );
  expect(output).toContain('PASS real SQLite');
}, 35000);
