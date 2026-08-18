import { describe, expect, it, vi } from 'vitest';
import { BranchStatusService } from '../src/git/BranchStatusService';
import { GitClient } from '../src/git/GitClient';

describe('BranchStatusService', () => {
  it('loads upstream ahead and behind state through Git', async () => {
    const run = vi.fn().mockResolvedValueOnce('origin/topic\n').mockResolvedValueOnce('3 2\n');
    const service = new BranchStatusService({ run } as unknown as GitClient);
    await expect(
      service.load([
        { name: 'topic', fullName: 'refs/heads/topic', type: 'localBranch', commitId: 'local' },
        {
          name: 'origin/topic',
          fullName: 'refs/remotes/origin/topic',
          type: 'remoteBranch',
          commitId: 'remote',
        },
      ]),
    ).resolves.toEqual([
      {
        ref: 'refs/heads/topic',
        local: true,
        remote: true,
        upstream: 'origin/topic',
        ahead: 3,
        behind: 2,
      },
    ]);
    expect(run).toHaveBeenNthCalledWith(2, [
      'rev-list',
      '--left-right',
      '--count',
      'refs/heads/topic...origin/topic',
    ]);
  });
});
