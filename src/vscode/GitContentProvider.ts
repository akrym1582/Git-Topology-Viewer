import * as vscode from 'vscode';
import { DiffService } from '../git/DiffService';
export class GitContentProvider implements vscode.TextDocumentContentProvider {
  static readonly scheme = 'git-topology';
  private emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;
  constructor(private diff: DiffService) {}
  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    if (params.get('exists') === 'false') return Promise.resolve('');
    return this.diff.show(params.get('ref') ?? '', params.get('path') ?? '');
  }
  static uri(ref: string, path: string, side: 'left' | 'right', exists = true): vscode.Uri {
    return vscode.Uri.parse(`${this.scheme}:/${encodeURIComponent(side)}/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}&exists=${exists}`);
  }
}
