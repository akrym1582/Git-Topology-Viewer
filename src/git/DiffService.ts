import { GitClient } from './GitClient';
import { BranchComparison, ChangedFile, CommitDetails, CommitInfo } from '../domain/models';
export class DiffService {
  constructor(private git: GitClient) {}
  private async commits(range: string): Promise<CommitInfo[]> {
    const out = await this.git.run(['log', '--format=%H%x00%s', range]);
    return this.parseCommits(out);
  }
  async log(ref: string, limit = 100): Promise<CommitInfo[]> {
    const out = await this.git.run(['log', `--max-count=${limit}`, '--format=%H%x00%s', ref, '--']);
    return this.parseCommits(out);
  }
  private parseCommits(out: string): CommitInfo[] {
    return out.split('\n').filter(Boolean).map(line => {
      const [id, subject = ''] = line.split('\0');
      return { id, subject };
    });
  }
  private parseFiles(out: string): ChangedFile[] {
    const tokens = out.split('\0').filter(Boolean); const files: ChangedFile[] = [];
    for (let i = 0; i < tokens.length;) {
      const status = tokens[i++];
      if (/^[RC]/.test(status)) { const oldPath = tokens[i++]; files.push({ status: status[0], oldPath, path: tokens[i++] }); }
      else files.push({ status: status[0], path: tokens[i++] });
    }
    return files;
  }
  private parseStats(out: string): Array<{ additions: number; deletions: number }> {
    const tokens = out.split('\0'); const stats: Array<{ additions: number; deletions: number }> = [];
    for (let i = 0; i < tokens.length;) {
      const entry = tokens[i++];
      if (!entry) continue;
      const [additions, deletions, path] = entry.split('\t');
      stats.push({ additions: Number(additions) || 0, deletions: Number(deletions) || 0 });
      if (!path) i += 2;
    }
    return stats;
  }
  async commitDetails(commit: string): Promise<CommitDetails> {
    const [metadata, parents, names, numstat] = await Promise.all([
      this.git.run(['show', '-s', '--format=%H%x00%s', commit]),
      this.git.run(['rev-list', '--parents', '-n', '1', commit]),
      this.git.run(['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--name-status', '-z', commit, '--']),
      this.git.run(['diff-tree', '--root', '--first-parent', '--no-commit-id', '-r', '--numstat', '-z', commit, '--'])
    ]);
    const [commitInfo] = this.parseCommits(metadata);
    if (!commitInfo) throw new Error('The selected commit could not be read. Refresh the viewer and try again.');
    const parent = parents.trim().split(/\s+/)[1];
    const stats = this.parseStats(numstat);
    const files = this.parseFiles(names).map((file, index) => ({ ...file, ...stats[index] }));
    return {
      commit: commitInfo,
      parent,
      additions: stats.reduce((total, stat) => total + stat.additions, 0),
      deletions: stats.reduce((total, stat) => total + stat.deletions, 0),
      files
    };
  }
  async compare(left: string, right: string, mode: 'divergence' | 'snapshot'): Promise<BranchComparison> {
    const [bases, onlyLeft, onlyRight] = await Promise.all([
      this.git.run(['merge-base', '--all', left, right]), this.commits(`${right}..${left}`), this.commits(`${left}..${right}`)
    ]);
    // Show what changed on the selected (left) ref, using right as the base.
    const range = mode === 'divergence' ? `${right}...${left}` : `${right}..${left}`;
    const [names, numstat] = await Promise.all([
      this.git.run(['diff', '--name-status', '-z', range]), this.git.run(['diff', '--numstat', '-z', range])
    ]);
    const files = this.parseFiles(names);
    const stats = this.parseStats(numstat);
    const additions = stats.reduce((total, stat) => total + stat.additions, 0);
    const deletions = stats.reduce((total, stat) => total + stat.deletions, 0);
    return { left, right, mode, mergeBases: bases.trim().split('\n').filter(Boolean), ahead: onlyLeft.length, behind: onlyRight.length, additions, deletions, files, onlyLeft, onlyRight };
  }
  show(ref: string, path: string): Promise<string> { return this.git.run(['show', `${ref}:${path}`]); }
}
