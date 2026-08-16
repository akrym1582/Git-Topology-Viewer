import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

export class GitError extends Error {
  constructor(message: string, readonly stderr = '') { super(message); }
}

export class GitClient {
  constructor(readonly executable: string, readonly cwd: string) {}
  async run(args: string[], options: { maxBuffer?: number } = {}): Promise<string> {
    try {
      const { stdout } = await exec(this.executable, ['-c', 'core.quotepath=false', ...args], {
        cwd: this.cwd, encoding: 'utf8', maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' }
      });
      return stdout;
    } catch (error) {
      const e = error as NodeJS.ErrnoException & { stderr?: string };
      throw new GitError(e.code === 'ENOENT' ? `Git executable not found: ${this.executable}` : e.message, e.stderr);
    }
  }
}
