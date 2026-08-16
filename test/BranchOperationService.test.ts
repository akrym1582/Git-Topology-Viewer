import { describe, expect, it, vi } from 'vitest';
import { BranchOperationService } from '../src/git/BranchOperationService';
import { GitClient, GitError } from '../src/git/GitClient';

function serviceWith(run: ReturnType<typeof vi.fn>): BranchOperationService {
  return new BranchOperationService({ run } as unknown as GitClient);
}

describe('BranchOperationService', () => {
  it('reads the current branch and recognizes a detached HEAD', async () => {
    const run = vi.fn().mockResolvedValueOnce('main\n').mockResolvedValueOnce('HEAD\n');
    const service = serviceWith(run);
    await expect(service.currentBranch()).resolves.toBe('main');
    await expect(service.currentBranch()).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledWith(['rev-parse', '--abbrev-ref', 'HEAD']);
  });

  it('passes branch names as separate switch and merge arguments', async () => {
    const run = vi.fn().mockResolvedValue('');
    const service = serviceWith(run);
    await service.switchTo('feature/topic');
    await service.merge('feature/topic');
    expect(run).toHaveBeenNthCalledWith(1, ['switch', '--', 'feature/topic']);
    expect(run).toHaveBeenNthCalledWith(2, ['merge', '--no-edit', '--', 'feature/topic']);
  });

  it('surfaces an actionable Git failure without the raw command line', async () => {
    const run = vi.fn().mockRejectedValue(new GitError('raw command failed', 'error: local changes would be overwritten\n'));
    await expect(serviceWith(run).switchTo('topic')).rejects.toThrow(
      'Could not switch to topic: error: local changes would be overwritten'
    );
  });
});
