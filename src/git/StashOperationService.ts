import { GitClient, GitError } from './GitClient';
import { GitCommandResult } from './BranchOperationService';

export interface StashEntry { name: string; commitId: string; subject: string }
export class StashOperationService {
  constructor(private git: GitClient) {}
  async load(): Promise<StashEntry[]> {
    const out = await this.git.run(['stash', 'list', '--format=%gd%x00%H%x00%s']);
    return out.split('\n').filter(Boolean).map(line => { const [name, commitId, subject] = line.split('\0'); return { name, commitId, subject }; });
  }
  apply(stash: string): Promise<GitCommandResult> { return this.execute(['stash', 'apply', stash]); }
  pop(stash: string): Promise<GitCommandResult> { return this.execute(['stash', 'pop', stash]); }
  drop(stash: string): Promise<GitCommandResult> { return this.execute(['stash', 'drop', stash]); }
  createBranch(name: string, stash: string): Promise<GitCommandResult> { return this.execute(['stash', 'branch', name, stash]); }
  private async execute(args: string[]): Promise<GitCommandResult> {
    try { return { success: true, stdout: await this.git.run(args), requiresRefresh: true }; }
    catch (error) { const stderr = error instanceof GitError ? error.stderr : String(error); const conflict = stderr.toLowerCase().includes('conflict'); return { success: false, conflict, stderr, errorType: conflict ? 'conflict' : 'unknown' }; }
  }
}
