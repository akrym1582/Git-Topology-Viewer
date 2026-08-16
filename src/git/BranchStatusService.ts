import { BranchStatus, GitRef } from '../domain/models';
import { GitClient } from './GitClient';

export class BranchStatusService {
  constructor(private git: GitClient) {}

  async load(refs: GitRef[]): Promise<BranchStatus[]> {
    const locals = refs.filter(ref => ref.type === 'localBranch');
    return Promise.all(locals.map(ref => this.loadLocal(ref, refs)));
  }

  private async loadLocal(ref: GitRef, refs: GitRef[]): Promise<BranchStatus> {
    const upstream = (await this.git.run(['for-each-ref', '--format=%(upstream:short)', ref.fullName])).trim() || undefined;
    const status: BranchStatus = { ref: ref.fullName, local: true, remote: Boolean(upstream) };
    if (!upstream) return status;
    status.upstream = upstream;
    status.remote = refs.some(candidate => candidate.type === 'remoteBranch' && candidate.name === upstream);
    const counts = (await this.git.run(['rev-list', '--left-right', '--count', `${ref.fullName}...${upstream}`])).trim().split(/\s+/);
    status.ahead = Number(counts[0]) || 0;
    status.behind = Number(counts[1]) || 0;
    return status;
  }
}
