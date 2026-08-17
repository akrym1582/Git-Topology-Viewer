import { describe, expect, it, vi } from 'vitest';
import { DiffService } from '../src/git/DiffService';
import { GitClient } from '../src/git/GitClient';

describe('DiffService', () => {
  it('loads first-parent history after the merge-base and identifies the branch point', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce('base123\n')
      .mockResolvedValueOnce('base123\0Branch point\n')
      .mockResolvedValueOnce('tip456\0Feature change\n');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.branchLog('refs/heads/feature', 'refs/heads/main')).resolves.toEqual({
      ref: 'refs/heads/feature', branchPoint: { id: 'base123', subject: 'Branch point' }, commits: [{ id: 'tip456', subject: 'Feature change' }]
    });
    expect(run).toHaveBeenNthCalledWith(1, ['merge-base', '--all', 'refs/heads/feature', 'refs/heads/main']);
    expect(run).toHaveBeenNthCalledWith(3, ['log', '--first-parent', '--max-count=100', '--format=%H%x00%s', 'base123..refs/heads/feature', '--']);
  });

  it('loads a commit summary with file-level additions and deletions', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce('f41acde1234567890\0Polish authentication flow\n')
      .mockResolvedValueOnce('f41acde1234567890 e93b2101234567890\n')
      .mockResolvedValueOnce('M\0src/AuthService.ts\0R100\0src/LegacyLogin.ts\0src/LoginService.ts\0')
      .mockResolvedValueOnce('10\t2\tsrc/AuthService.ts\0 0\t0\t\0src/LegacyLogin.ts\0src/LoginService.ts\0');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.commitDetails('f41acde1234567890')).resolves.toEqual({
      commit: { id: 'f41acde1234567890', subject: 'Polish authentication flow' },
      parent: 'e93b2101234567890', additions: 10, deletions: 2,
      files: [
        { status: 'M', path: 'src/AuthService.ts', additions: 10, deletions: 2 },
        { status: 'R', oldPath: 'src/LegacyLogin.ts', path: 'src/LoginService.ts', additions: 0, deletions: 0 }
      ]
    });
    expect(run).toHaveBeenNthCalledWith(3, ['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--name-status', '-z', 'f41acde1234567890', '--']);
    expect(run).toHaveBeenNthCalledWith(4, ['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--numstat', '-z', 'f41acde1234567890', '--']);
  });
});
