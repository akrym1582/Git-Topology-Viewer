import { GitClient } from './GitClient';
import { BranchComparison, ChangedFile, CommitInfo } from '../domain/models';
export class DiffService {
  constructor(private git: GitClient) {}
  private async commits(range: string): Promise<CommitInfo[]> {
    const out = await this.git.run(['log', '--format=%H%x00%s', range]);
    return out.split('\n').filter(Boolean).map(line => { const [id, subject = ''] = line.split('\0'); return { id, subject }; });
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
    const tokens = names.split('\0').filter(Boolean); const files: ChangedFile[] = [];
    for (let i = 0; i < tokens.length;) {
      const status = tokens[i++];
      if (/^[RC]/.test(status)) { const oldPath = tokens[i++]; files.push({ status: status[0], oldPath, path: tokens[i++] }); }
      else files.push({ status: status[0], path: tokens[i++] });
    }
    let additions = 0, deletions = 0; const stats = numstat.split('\0').filter(Boolean);
    for (const stat of stats) { const [a, d] = stat.split('\t'); additions += Number(a) || 0; deletions += Number(d) || 0; }
    return { left, right, mode, mergeBases: bases.trim().split('\n').filter(Boolean), ahead: onlyLeft.length, behind: onlyRight.length, additions, deletions, files, onlyLeft, onlyRight };
  }
  show(ref: string, path: string): Promise<string> { return this.git.run(['show', `${ref}:${path}`]); }
}
