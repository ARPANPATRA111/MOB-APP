import { execFileSync } from 'node:child_process';
it('rejects malformed images and decodes hostile input without blocking', () => {
  const output = execFileSync(process.execPath, ['scripts/check-dependency-patches.cjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 8000,
  });
  expect(output).toContain('PASS dependency security');
}, 10000);
