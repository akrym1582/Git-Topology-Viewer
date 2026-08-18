import { GitClient, GitError } from './GitClient';
import { GitCommandResult } from './BranchOperationService';
export class CommitOperationService {
  constructor(private git: GitClient) {}
  checkoutDetached(hash: string) { return this.execute(['switch', '--detach', '--', hash]); }
  createTag(name: string, hash: string) { return this.execute(['tag', name, hash]); }
  cherryPick(hash: string) { return this.execute(['cherry-pick', hash]); }
  revert(hash: string) { return this.execute(['revert', hash]); }
  continueCherryPick() { return this.execute(['cherry-pick', '--continue']); }
  abortCherryPick() { return this.execute(['cherry-pick', '--abort']); }
  private async execute(args: string[]): Promise<GitCommandResult> { try { return { success: true, stdout: await this.git.run(args), requiresRefresh: true }; } catch (e) { const stderr=e instanceof GitError?e.stderr:String(e), conflict=stderr.toLowerCase().includes('conflict'); return { success:false, conflict, stderr, errorType: conflict?'conflict':'unknown' }; } }
}
