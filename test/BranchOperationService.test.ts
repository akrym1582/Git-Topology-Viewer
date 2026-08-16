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

  it('passes branch names as separate switch, create, and merge arguments', async () => {
    const run = vi.fn().mockResolvedValue('');
    const service = serviceWith(run);
    await service.switchTo('feature/topic');
    await service.createBranch('new topic', 'refs/tags/v1');
    await service.merge('feature/topic');
    expect(run).toHaveBeenNthCalledWith(1, ['switch', '--', 'feature/topic']);
    expect(run).toHaveBeenNthCalledWith(2, ['switch', '-c', 'new topic', '--', 'refs/tags/v1']);
    expect(run).toHaveBeenCalledWith(['merge', '--no-edit', '--', 'feature/topic']);
  });

  it('normalizes a Git failure without throwing a CLI exception into the UI', async () => {
    const run = vi.fn().mockRejectedValue(new GitError('raw command failed', 'error: local changes would be overwritten\n'));
    await expect(serviceWith(run).switchTo('topic')).resolves.toMatchObject({ success: false, errorType: 'dirtyWorkingTree' });
  });
});
