import { GitClient } from './GitClient';
import { GitRef, RefType } from '../domain/models';
export class RefLoader {
  constructor(private git: GitClient) {}
  async load(): Promise<GitRef[]> {
    const format = '%(refname)%00%(objectname)%00%(*objectname)';
    const out = await this.git.run(['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes', 'refs/tags']);
    return out.split('\n').filter(Boolean).map(line => {
      const [fullName, object, peeled] = line.split('\0');
      const type: RefType = fullName.startsWith('refs/heads/') ? 'localBranch' : fullName.startsWith('refs/remotes/') ? 'remoteBranch' : 'tag';
      const prefix = type === 'localBranch' ? 'refs/heads/' : type === 'remoteBranch' ? 'refs/remotes/' : 'refs/tags/';
      return { fullName, name: fullName.slice(prefix.length), type, commitId: peeled || object };
    });
  }
}
