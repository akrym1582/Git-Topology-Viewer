import { GitClient, GitError } from './GitClient';

export class BranchOperationService {
  constructor(private git: GitClient) {}

  async currentBranch(): Promise<string | undefined> {
    const branch = (await this.git.run(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    return branch === 'HEAD' ? undefined : branch;
  }

  async switchTo(branch: string): Promise<void> {
    try {
      await this.git.run(['switch', '--', branch]);
    } catch (error) {
      throw this.actionableError(error, `Could not switch to ${branch}`);
    }
  }

  async createBranch(name: string, startPoint: string): Promise<void> {
    try {
      await this.git.run(['switch', '-c', name, '--', startPoint]);
    } catch (error) {
      throw this.actionableError(error, `Could not create ${name}`);
    }
  }

  async merge(branch: string): Promise<void> {
    try {
      await this.git.run(['merge', '--no-edit', '--', branch]);
    } catch (error) {
      throw this.actionableError(error, `Could not merge ${branch}`);
    }
  }

  private actionableError(error: unknown, fallback: string): Error {
    if (!(error instanceof GitError)) return new Error(fallback);
    const detail = error.stderr.trim().split('\n').at(-1);
    return new Error(detail ? `${fallback}: ${detail}` : fallback);
  }
}
