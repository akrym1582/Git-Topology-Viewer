import { describe, expect, it, vi } from 'vitest';
import { DiffService } from '../src/git/DiffService';
import { GitClient } from '../src/git/GitClient';

describe('DiffService', () => {
  it('loads first-parent history after the merge-base and identifies the branch point', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce('base123\n')
      .mockResolvedValueOnce('base123\x00Branch point\x00Release Bot\x002025-01-02T03:04:05+09:00\n')
      .mockResolvedValueOnce('tip456\x00Feature change\x00Feature Bot\x002025-01-03T03:04:05+09:00\n');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.branchLog('refs/heads/feature', 'refs/heads/main')).resolves.toEqual({
      ref: 'refs/heads/feature', branchPoint: { id: 'base123', subject: 'Branch point', committer: 'Release Bot', date: '2025-01-02T03:04:05+09:00' }, commits: [{ id: 'tip456', subject: 'Feature change', committer: 'Feature Bot', date: '2025-01-03T03:04:05+09:00' }]
    });
    expect(run).toHaveBeenNthCalledWith(1, ['merge-base', '--all', 'refs/heads/feature', 'refs/heads/main']);
    expect(run).toHaveBeenNthCalledWith(3, ['log', '--first-parent', '--max-count=100', '--format=%H%x00%s%x00%cn%x00%cI', 'base123..refs/heads/feature', '--']);
  });

  it('loads a commit summary with file-level additions and deletions', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce('f41acde1234567890\x00Polish authentication flow\x00Release Bot\x002025-01-04T03:04:05+09:00\n')
      .mockResolvedValueOnce('f41acde1234567890 e93b2101234567890\n')
      .mockResolvedValueOnce('M\0src/AuthService.ts\0R100\0src/LegacyLogin.ts\0src/LoginService.ts\0')
      .mockResolvedValueOnce('10\t2\tsrc/AuthService.ts\0 0\t0\t\0src/LegacyLogin.ts\0src/LoginService.ts\0');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.commitDetails('f41acde1234567890')).resolves.toEqual({
      commit: { id: 'f41acde1234567890', subject: 'Polish authentication flow', committer: 'Release Bot', date: '2025-01-04T03:04:05+09:00' },
      parent: 'e93b2101234567890', additions: 10, deletions: 2,
      files: [
        { status: 'M', path: 'src/AuthService.ts', additions: 10, deletions: 2 },
        { status: 'R', oldPath: 'src/LegacyLogin.ts', path: 'src/LoginService.ts', additions: 0, deletions: 0 }
      ]
    });
    expect(run).toHaveBeenNthCalledWith(3, ['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--name-status', '-z', 'f41acde1234567890', '--']);
    expect(run).toHaveBeenNthCalledWith(4, ['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--numstat', '-z', 'f41acde1234567890', '--']);
  });

  it('loads subjects for a summarized commit group in the requested order', async () => {
    const run = vi.fn().mockResolvedValue('c16a9821234567890\0Second change\nb16a9821234567890\0First change\n');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.commitSummaries(['b16a9821234567890', 'c16a9821234567890'])).resolves.toEqual([
      { id: 'b16a9821234567890', subject: 'First change' }, { id: 'c16a9821234567890', subject: 'Second change' }
    ]);
    expect(run).toHaveBeenCalledWith(['show', '-s', '--format=%H%x00%s%x00%cn%x00%cI', 'b16a9821234567890', 'c16a9821234567890']);
  });

  it('reads the full commit message without the terminal newline', async () => {
    const run = vi.fn().mockResolvedValue('Subject\n\nDetailed explanation\n');
    const service = new DiffService({ run } as unknown as GitClient);

    await expect(service.commitMessage('f41acde1234567890')).resolves.toBe('Subject\n\nDetailed explanation');
    expect(run).toHaveBeenCalledWith(['show', '-s', '--format=%B', 'f41acde1234567890']);
  });
});
