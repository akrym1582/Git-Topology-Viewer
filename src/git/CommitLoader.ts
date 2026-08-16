import { GitClient } from './GitClient';
import { CommitGraph, CommitNode, GitRef } from '../domain/models';
export class CommitLoader {
  constructor(private git: GitClient) {}
  async load(refs: GitRef[], maxCount: number): Promise<CommitGraph> {
    const out = await this.git.run(['rev-list', '--parents', '--topo-order', '--date-order', `--max-count=${maxCount}`, '--all']);
    const byCommit = new Map<string, GitRef[]>();
    refs.forEach(ref => byCommit.set(ref.commitId, [...(byCommit.get(ref.commitId) ?? []), ref]));
    const nodes = new Map<string, CommitNode>(); const order: string[] = [];
    out.split('\n').filter(Boolean).forEach(line => { const [id, ...parents] = line.split(' '); order.push(id); nodes.set(id, { id, parents, refs: byCommit.get(id) ?? [] }); });
    return { nodes, order };
  }
}
