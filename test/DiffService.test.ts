import { describe, expect, it, vi } from 'vitest';
import { DiffService } from '../src/git/DiffService';
import { GitClient } from '../src/git/GitClient';

describe('DiffService', () => {
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
