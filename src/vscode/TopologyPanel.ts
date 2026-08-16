import * as vscode from 'vscode';
import * as path from 'node:path';
import { GitClient } from '../git/GitClient';
import { RefLoader } from '../git/RefLoader';
import { CommitLoader } from '../git/CommitLoader';
import { DiffService } from '../git/DiffService';
import { TopologyBuilder } from '../domain/TopologyBuilder';
import { CommitGraph, GitRef, ViewMode } from '../domain/models';
import { GitContentProvider } from './GitContentProvider';
import { isWebviewRequest, WebviewRequest } from './messages';

export class TopologyPanel {
  private static current: TopologyPanel | undefined;
  private mode: ViewMode = 'topology'; private expanded = new Set<string>();
  private refs: GitRef[] = []; private graph?: CommitGraph;
  private readonly diff: DiffService; private readonly disposables: vscode.Disposable[] = [];
  private constructor(private panel: vscode.WebviewPanel, private git: GitClient, private root: string, extensionUri: vscode.Uri) {
    this.diff = new DiffService(git); panel.webview.html = this.html(panel.webview, extensionUri);
    panel.webview.onDidReceiveMessage((message: unknown) => this.receiveMessage(message), undefined, this.disposables);
    panel.onDidDispose(() => { this.disposables.forEach(d => d.dispose()); TopologyPanel.current = undefined; });
    this.load();
  }
  static show(git: GitClient, root: string, extensionUri: vscode.Uri): TopologyPanel {
    if (this.current) { this.current.panel.reveal(); return this.current; }
    const panel = vscode.window.createWebviewPanel('gitTopology', `Git Topology: ${path.basename(root)}`, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')] });
    return this.current = new TopologyPanel(panel, git, root, extensionUri);
  }
  private async load() {
    try {
      this.refs = await new RefLoader(this.git).load();
      this.graph = await new CommitLoader(this.git).load(this.refs, vscode.workspace.getConfiguration('gitTopology').get('maxCommits', 10000));
      this.sendGraph();
    } catch (e) { this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
  }
  private sendGraph() {
    if (!this.graph) return;
    this.post({ type: 'graph', payload: { graph: new TopologyBuilder().build(this.graph, this.mode, this.expanded), refs: this.refs, repository: path.basename(this.root), mode: this.mode, expandedRangeIds: [...this.expanded] } });
  }
  private receiveMessage(message: unknown): void {
    if (!isWebviewRequest(message)) {
      this.post({ type: 'error', message: 'The webview sent an invalid request. Refresh the viewer and try again.' });
      return;
    }
    void this.message(message);
  }
  private async message(message: WebviewRequest) {
    try {
      if (message.type === 'refresh') { this.expanded.clear(); await this.load(); }
      if (message.type === 'setViewMode') { this.mode = message.mode; this.sendGraph(); }
      if (message.type === 'expandRange') { this.expanded.add(message.rangeId); this.sendGraph(); }
      if (message.type === 'compareRefs') this.post({ type: 'comparison', payload: await this.diff.compare(message.left, message.right, message.mode) });
      if (message.type === 'openDiff') {
        const left = GitContentProvider.uri(message.left, message.path, 'left', message.status !== 'D');
        const rightPath = message.oldPath ?? message.path;
        const right = GitContentProvider.uri(message.right, rightPath, 'right', message.status !== 'A');
        await vscode.commands.executeCommand('vscode.diff', left, right, `${message.path} (${message.left} ↔ ${message.right})`);
      }
      if (message.type === 'copy') await vscode.env.clipboard.writeText(message.value);
    } catch (e) { this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
  }
  private post(value: unknown) { void this.panel.webview.postMessage(value); }
  private html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
    const nonce = Math.random().toString(36).slice(2);
    return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"><title>Git Topology</title></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}
