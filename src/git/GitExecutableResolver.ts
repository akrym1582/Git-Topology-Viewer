import * as vscode from 'vscode';
import { GitClient } from './GitClient';

export interface GitExecutable { path: string; version: string }
export class GitExecutableResolver {
  static async resolve(cwd: string): Promise<GitExecutable> {
    const configured = vscode.workspace.getConfiguration('gitTopology').get<string>('gitPath')?.trim();
    const builtIn = vscode.extensions.getExtension('vscode.git')?.exports?.getAPI?.(1)?.git?.path as string | undefined;
    const candidates = [...new Set([builtIn, configured, 'git'].filter(Boolean) as string[])];
    for (const path of candidates) {
      try {
        const version = (await new GitClient(path, cwd).run(['--version'])).trim().replace(/^git version\s+/, '');
        return { path, version };
      } catch { /* try the next documented source */ }
    }
    throw new Error('Git was not found. Install Git or configure gitTopology.gitPath.');
  }
}
