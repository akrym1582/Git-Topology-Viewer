import { GitClient, GitError } from './GitClient';

export type GitCommandErrorType =
  | 'dirtyWorkingTree'
  | 'conflict'
  | 'branchNotMerged'
  | 'authentication'
  | 'remoteRejected'
  | 'unknown';
export interface GitCommandResult {
  success: boolean;
  conflict?: boolean;
  stdout?: string;
  stderr?: string;
  requiresRefresh?: boolean;
  errorType?: GitCommandErrorType;
}

export class BranchOperationService {
  constructor(private git: GitClient) {}

  async currentBranch(): Promise<string | undefined> {
    const branch = (await this.git.run(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    return branch === 'HEAD' ? undefined : branch;
  }
  async isWorkingTreeClean(): Promise<boolean> {
    return (await this.git.run(['status', '--porcelain'])).length === 0;
  }
  async switchTo(branch: string): Promise<GitCommandResult> {
    return this.execute(['switch', '--', branch]);
  }
  async createBranch(name: string, startPoint: string): Promise<GitCommandResult> {
    return this.execute(['switch', '-c', name, '--', startPoint]);
  }
  async checkoutRemote(remoteBranch: string, localBranch: string): Promise<GitCommandResult> {
    return this.execute(['switch', '--track', '-c', localBranch, '--', remoteBranch]);
  }
  async push(branch: string, remote?: string, setUpstream = false): Promise<GitCommandResult> {
    if (setUpstream && remote) return this.execute(['push', '-u', remote, branch]);

    const pushRemote =
      remote ??
      (
        await this.git.run([
          'for-each-ref',
          '--format=%(upstream:remotename)',
          '--',
          `refs/heads/${branch}`,
        ])
      ).trim();
    if (!pushRemote) {
      return {
        success: false,
        stderr: `Branch ${branch} has no upstream remote.`,
        errorType: 'unknown',
      };
    }
    return this.execute(['push', pushRemote, branch]);
  }
  async pull(branch: string): Promise<GitCommandResult> {
    if (branch !== (await this.currentBranch()))
      return {
        success: false,
        stderr: 'Pull is available only for the current branch.',
        errorType: 'unknown',
      };
    return this.execute(['pull']);
  }
  async fetch(remote?: string): Promise<GitCommandResult> {
    return this.execute(remote ? ['fetch', remote] : ['fetch']);
  }
  async mergeIntoCurrent(branch: string): Promise<GitCommandResult> {
    if (!(await this.isWorkingTreeClean()))
      return {
        success: false,
        stderr:
          'Working tree has uncommitted changes. Commit or stash your changes before merging.',
        errorType: 'dirtyWorkingTree',
      };
    if (branch === (await this.currentBranch()))
      return { success: false, stderr: 'Cannot merge a branch into itself.', errorType: 'unknown' };
    return this.execute(['merge', '--no-edit', '--', branch]);
  }
  async merge(branch: string): Promise<GitCommandResult> {
    return this.mergeIntoCurrent(branch);
  }
  async rebaseCurrentOnto(branch: string): Promise<GitCommandResult> {
    if (!(await this.isWorkingTreeClean()))
      return {
        success: false,
        stderr:
          'Working tree has uncommitted changes. Commit or stash your changes before rebasing.',
        errorType: 'dirtyWorkingTree',
      };
    if (branch === (await this.currentBranch()))
      return {
        success: false,
        stderr: 'Cannot rebase a branch onto itself.',
        errorType: 'unknown',
      };
    return this.execute(['rebase', branch]);
  }
  async continueRebase(): Promise<GitCommandResult> {
    return this.execute(['rebase', '--continue']);
  }
  async abortRebase(): Promise<GitCommandResult> {
    return this.execute(['rebase', '--abort']);
  }
  async deleteLocalBranch(branch: string, force = false): Promise<GitCommandResult> {
    if (branch === (await this.currentBranch()))
      return {
        success: false,
        stderr: 'The current branch cannot be deleted.',
        errorType: 'unknown',
      };
    return this.execute(['branch', force ? '-D' : '-d', '--', branch]);
  }
  async deleteRemoteBranch(remote: string, branch: string): Promise<GitCommandResult> {
    return this.execute(['push', remote, '--delete', branch]);
  }

  private async execute(args: string[]): Promise<GitCommandResult> {
    try {
      return { success: true, stdout: await this.git.run(args), requiresRefresh: true };
    } catch (error) {
      const stderr = error instanceof GitError ? error.stderr : String(error);
      const lower = stderr.toLowerCase();
      const conflict = lower.includes('conflict');
      const errorType: GitCommandErrorType = conflict
        ? 'conflict'
        : lower.includes('not fully merged') || lower.includes('not fully merged')
          ? 'branchNotMerged'
          : lower.includes('authentication') || lower.includes('permission denied')
            ? 'authentication'
            : lower.includes('rejected')
              ? 'remoteRejected'
              : lower.includes('local changes') || lower.includes('uncommitted')
                ? 'dirtyWorkingTree'
                : 'unknown';
      return { success: false, conflict, stderr, errorType };
    }
  }
}
