import * as vscode from 'vscode';
import * as path from 'node:path';
import { GitClient } from '../git/GitClient';
import { RefLoader } from '../git/RefLoader';
import { CommitLoader } from '../git/CommitLoader';
import { DiffService } from '../git/DiffService';
import { BranchOperationService } from '../git/BranchOperationService';
import { BranchStatusService } from '../git/BranchStatusService';
import { BranchRelationBuilder } from '../domain/BranchRelationBuilder';
import { BranchStatus, CommitGraph, GitRef, RefVisibility } from '../domain/models';
import { GitContentProvider } from './GitContentProvider';
import { GraphContextMenuItem, GraphMenuCommand, isWebviewRequest, WebviewRequest } from './messages';
import { ContextMenuPolicy } from './ContextMenuPolicy';

export class TopologyPanel {
  private static current: TopologyPanel | undefined;
  private compareBase?: string; private mergeBaseIds: string[] = []; private focusedRef?: string;
  private refs: GitRef[] = []; private branchStatuses: BranchStatus[] = []; private graph?: CommitGraph; private currentBranch?: string;
  private refVisibility: RefVisibility = { tags: true, remotes: false };
  private readonly diff: DiffService; private readonly disposables: vscode.Disposable[] = [];
  private readonly operations: BranchOperationService;
  private readonly menuPolicy = new ContextMenuPolicy();
  private constructor(private panel: vscode.WebviewPanel, private git: GitClient, private root: string, private workspaceState: vscode.Memento, extensionUri: vscode.Uri) {
    this.compareBase = workspaceState.get<string>('gitTopology.compareBase');
    this.diff = new DiffService(git); this.operations = new BranchOperationService(git); panel.webview.html = this.html(panel.webview, extensionUri);
    panel.webview.onDidReceiveMessage((message: unknown) => this.receiveMessage(message), undefined, this.disposables);
    panel.onDidDispose(() => { this.disposables.forEach(d => d.dispose()); TopologyPanel.current = undefined; });
    this.load();
  }
  static show(git: GitClient, root: string, extensionUri: vscode.Uri, workspaceState: vscode.Memento): TopologyPanel {
    if (this.current) { this.current.panel.reveal(); return this.current; }
    const panel = vscode.window.createWebviewPanel('gitTopology', vscode.l10n.t('Git Topology: {0}', path.basename(root)), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')] });
    return this.current = new TopologyPanel(panel, git, root, workspaceState, extensionUri);
  }
  private async load() {
    try {
      this.refs = await new RefLoader(this.git).load();
      this.branchStatuses = await new BranchStatusService(this.git).load(this.refs);
      this.graph = await new CommitLoader(this.git).load(this.refs, vscode.workspace.getConfiguration('gitTopology').get('maxCommits', 10000));
      this.currentBranch = await this.operations.currentBranch();
      this.sendGraph();
    } catch (e) { this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
  }
  private sendGraph() {
    if (!this.graph) return;
    this.post({ type: 'graph', payload: { graph: new BranchRelationBuilder().build(this.graph, this.refVisibility), refs: this.refs, branchStatuses: this.branchStatuses, repository: path.basename(this.root), currentBranch: this.currentBranch, compareBase: this.compareBase, mergeBaseIds: this.mergeBaseIds, focusedRef: this.focusedRef } });
  }
  private receiveMessage(message: unknown): void {
    if (!isWebviewRequest(message)) {
      this.post({ type: 'error', message: this.t('The webview sent an invalid request. Refresh the viewer and try again.') });
      return;
    }
    void this.message(message);
  }
  private async message(message: WebviewRequest) {
    try {
      if (message.type === 'refresh') await this.load();
      if (message.type === 'setRefVisibility') { this.refVisibility = { tags: message.tags, remotes: message.remotes }; this.sendGraph(); }
      if (message.type === 'contextMenu') this.sendContextMenu(message.nodeId, message.selectedRefs, message.x, message.y);
      if (message.type === 'runContextCommand') await this.runContextCommand(message.command, message.nodeId, message.selectedRefs);
      if (message.type === 'compareRefs') {
        this.assertKnownRef(message.left);
        this.assertKnownRef(message.right);
        this.post({ type: 'comparison', payload: await this.diff.compare(message.left, message.right, message.mode) });
      }
      if (message.type === 'switchBranch') await this.switchBranch(message.ref);
      if (message.type === 'mergeBranch') await this.mergeBranch(message.ref);
      if (message.type === 'openDiff') {
        const left = GitContentProvider.uri(message.left, message.path, 'left', message.status !== 'D');
        const rightPath = message.oldPath ?? message.path;
        const right = GitContentProvider.uri(message.right, rightPath, 'right', message.status !== 'A');
        await vscode.commands.executeCommand('vscode.diff', left, right, `${message.path} (${message.left} ↔ ${message.right})`);
      }
      if (message.type === 'copy') await vscode.env.clipboard.writeText(message.value);
    } catch (e) { this.post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
  }

  private sendContextMenu(nodeId: string, selectedRefs: string[], x: number, y: number): void {
    const ref = this.knownRef(nodeId);
    const selection = selectedRefs.map(candidate => this.knownRef(candidate));
    if (!selection.some(candidate => candidate.fullName === ref.fullName)) throw new Error(this.t('The context-menu selection is stale. Refresh the viewer and try again.'));
    if (selection.length === 2) {
      this.post({ type: 'contextMenuItems', nodeId, selectedRefs: selection.map(candidate => candidate.fullName), x, y, items: this.menuPolicy.comparisonItems(message => this.t(message)) });
      return;
    }
    const local = ref.type === 'localBranch';
    const hasCurrent = Boolean(this.currentBranch && this.currentBranch !== ref.name);
    const hasBase = Boolean(this.compareBase && this.compareBase !== ref.fullName);
    const item = (command: GraphMenuCommand, label: string, group: GraphContextMenuItem['group'], enabled = true): GraphContextMenuItem => ({ command, label, group, enabled, visible: true });
    const items = [
      item('compareCurrent', this.t('Compare with Current Branch'), 'compare', hasCurrent),
      item('selectCompareBase', this.compareBase === ref.fullName ? this.t('Compare Base (selected)') : this.t('Select as Compare Base'), 'compare', this.compareBase !== ref.fullName),
      item('compareWith', this.t('Compare with…'), 'compare', this.refs.length > 1),
      item('compareBase', this.t('Compare with Selected Base'), 'compare', hasBase),
      item('showChangedFiles', this.t('Show Changed Files'), 'compare', hasCurrent || hasBase),
      item('showMergeBase', this.t('Show Merge Base'), 'compare', hasCurrent || hasBase),
      item('focus', this.t(ref.type === 'tag' ? 'Focus on This Tag' : 'Focus on This Branch'), 'graph'),
      item('related', this.t('Show Related Branches Only'), 'graph'),
      item('checkout', this.t('Checkout'), 'git', local && this.currentBranch !== ref.name), item('createBranch', this.t('Create Branch from Here…'), 'git'),
      item('copyName', this.t(ref.type === 'tag' ? 'Copy Tag Name' : 'Copy Branch Name'), 'copy'), item('copyHash', this.t('Copy Commit Hash'), 'copy')
    ];
    const status = this.branchStatuses.find(candidate => candidate.ref === ref.fullName);
    items.push(...this.menuPolicy.branchItems({ ref, currentBranch: this.currentBranch, hasUpstream: Boolean(status?.upstream), operation: { type: 'normal', hasConflicts: false } }, message => this.t(message)));
    this.post({ type: 'contextMenuItems', nodeId, selectedRefs: [ref.fullName], x, y, items });
  }
  private async runContextCommand(command: GraphMenuCommand, nodeId: string, selectedRefs?: string[]): Promise<void> {
    const ref = this.knownRef(nodeId);
    if (command === 'compareSelected' || command === 'compareSelectedSnapshots' || command === 'showSelectedMergeBase') {
      if (!selectedRefs || selectedRefs.length !== 2) throw new Error(this.t('Select exactly two refs before using a comparison menu action.'));
      const selection = selectedRefs.map(candidate => this.knownRef(candidate));
      if (!selection.some(candidate => candidate.fullName === ref.fullName)) throw new Error(this.t('The comparison selection is stale. Refresh the viewer and try again.'));
      const result = await this.compare(selection[0].fullName, selection[1].fullName, command === 'compareSelectedSnapshots' ? 'snapshot' : 'divergence');
      if (command === 'showSelectedMergeBase') { this.mergeBaseIds = result.mergeBases; this.sendGraph(); }
      return;
    }
    const comparisonBase = this.compareBase && this.compareBase !== ref.fullName
      ? this.compareBase : this.currentBranch ? `refs/heads/${this.currentBranch}` : undefined;
    if (command === 'selectCompareBase') { this.compareBase = ref.fullName; await this.workspaceState.update('gitTopology.compareBase', ref.fullName); this.sendGraph(); return; }
    if (command === 'compareCurrent') await this.compare(ref.fullName, this.currentBranch ? `refs/heads/${this.currentBranch}` : undefined);
    if (command === 'compareWith') {
      const candidates = this.refs.filter(candidate => candidate.fullName !== ref.fullName);
      const picked = await vscode.window.showQuickPick(candidates.map(candidate => ({ label: candidate.name, description: candidate.type, ref: candidate.fullName })), { title: this.t('Compare {0} with…', ref.name) });
      if (picked) await this.compare(ref.fullName, picked.ref);
    }
    if (command === 'compareBase' || command === 'showChangedFiles') await this.compare(ref.fullName, comparisonBase);
    if (command === 'showMergeBase') { const result = await this.compare(ref.fullName, comparisonBase); this.mergeBaseIds = result.mergeBases; this.sendGraph(); }
    if (command === 'focus' || command === 'related') { this.focusedRef = this.focusedRef === ref.fullName ? undefined : ref.fullName; this.post({ type: 'focusRef', ref: this.focusedRef, commitId: ref.commitId, relatedOnly: command === 'related' }); this.sendGraph(); }
    if (command === 'checkout') await this.switchBranch(ref.fullName);
    if (command === 'createBranch') await this.createBranch(ref);
    if (command === 'push') await this.push(ref);
    if (command === 'pull') await this.runResult(await this.operations.pull(ref.name), this.t('Pulled {0}.', ref.name));
    if (command === 'fetch') await this.fetch(ref);
    if (command === 'checkoutRemote') await this.checkoutRemote(ref);
    if (command === 'mergeIntoCurrent') await this.mergeBranch(ref.fullName);
    if (command === 'rebaseCurrentOnto') await this.rebase(ref);
    if (command === 'deleteLocal') await this.deleteLocal(ref);
    if (command === 'deleteRemote') await this.deleteRemote(ref);
    if (command === 'copyName') await vscode.env.clipboard.writeText(ref.name);
    if (command === 'copyHash') await vscode.env.clipboard.writeText(ref.commitId);
  }
  private async compare(left: string, right?: string, mode: 'divergence' | 'snapshot' = 'divergence') {
    if (!right) throw new Error(this.t('Select a compare base or check out a local branch first.'));
    const result = await this.diff.compare(left, right, mode);
    this.mergeBaseIds = result.mergeBases;
    this.post({ type: 'comparison', payload: result });
    this.sendGraph();
    return result;
  }
  private async createBranch(ref: GitRef): Promise<void> {
    const name = await vscode.window.showInputBox({ title: this.t('Create branch from {0}', ref.name), prompt: this.t('New branch name'), validateInput: value => value.trim() ? undefined : this.t('Enter a branch name.') });
    if (!name) return;
    await this.runResult(await this.operations.createBranch(name.trim(), ref.fullName), this.t('Created and checked out {0}.', name.trim()));
  }
  private knownRef(fullName: string): GitRef {
    const ref = this.refs.find(candidate => candidate.fullName === fullName);
    if (!ref) throw new Error(this.t('The selected ref no longer exists. Refresh the viewer and try again.'));
    return ref;
  }

  private async switchBranch(ref: string): Promise<void> {
    const branch = this.localBranchName(ref);
    await this.runResult(await this.operations.switchTo(branch), this.t('Switched to {0}.', branch));
  }
  private async mergeBranch(ref: string): Promise<void> {
    const branch = this.localBranchName(ref);
    const current = await this.operations.currentBranch();
    if (!current) throw new Error(this.t('Check out a local branch before merging.'));
    if (current === branch) throw new Error(this.t('{0} is already the current branch.', branch));
    const merge = this.t('Merge Branch');
    const choice = await vscode.window.showWarningMessage(this.t('Merge {0} into the current branch ({1})?', branch, current), { modal: true }, merge);
    if (choice !== merge) return;
    await this.runResult(await this.operations.mergeIntoCurrent(branch), this.t('Merged {0} into {1}.', branch, current));
  }
  private async push(ref: GitRef): Promise<void> {
    if (ref.type !== 'localBranch') return;
    const status = this.branchStatuses.find(value => value.ref === ref.fullName);
    if (status?.upstream) return this.runResult(await this.operations.push(ref.name), this.t('Pushed {0}.', ref.name));
    const remote = await this.pickRemote(this.t('Push {0} and set upstream', ref.name)); if (!remote) return;
    await this.runResult(await this.operations.push(ref.name, remote, true), this.t('Pushed {0} to {1} and set upstream.', ref.name, remote));
  }
  private async fetch(ref: GitRef): Promise<void> {
    const remote = ref.type === 'remoteBranch' ? ref.name.split('/')[0] : await this.pickRemote(this.t('Fetch for {0}', ref.name));
    if (remote) await this.runResult(await this.operations.fetch(remote), this.t('Fetched {0}.', remote));
  }
  private async checkoutRemote(ref: GitRef): Promise<void> {
    if (ref.type !== 'remoteBranch') return;
    const local = ref.name.includes('/') ? ref.name.slice(ref.name.indexOf('/') + 1) : ref.name;
    const existing = this.refs.find(value => value.type === 'localBranch' && value.name === local);
    if (existing) { const checkout = this.t('Checkout Existing'); const choice = await vscode.window.showInformationMessage(this.t('Local branch "{0}" already exists.', local), checkout, this.t('Cancel')); if (choice === checkout) await this.switchBranch(existing.fullName); return; }
    await this.runResult(await this.operations.checkoutRemote(ref.name, local), this.t('Checked out {0} as {1}.', ref.name, local));
  }
  private async rebase(ref: GitRef): Promise<void> {
    const current = this.currentBranch; if (!current) throw new Error(this.t('Check out a local branch before rebasing.'));
    const rebase = this.t('Rebase'); const choice = await vscode.window.showWarningMessage(this.t('Rebase "{0}" onto "{1}"? This rewrites commit history.', current, ref.name), { modal: true }, rebase);
    if (choice === rebase) await this.runResult(await this.operations.rebaseCurrentOnto(ref.name), this.t('Rebased {0} onto {1}.', current, ref.name));
  }
  private async deleteLocal(ref: GitRef): Promise<void> {
    const remove = this.t('Delete'); const choice = await vscode.window.showWarningMessage(this.t('Delete local branch "{0}"?', ref.name), { modal: true }, remove); if (choice !== remove) return;
    let result = await this.operations.deleteLocalBranch(ref.name);
    if (!result.success && result.errorType === 'branchNotMerged') { const forceDelete = this.t('Force Delete'); const force = await vscode.window.showWarningMessage(this.t('Branch has unmerged commits. Force delete "{0}"? This may permanently remove commits.', ref.name), { modal: true }, forceDelete); if (force === forceDelete) result = await this.operations.deleteLocalBranch(ref.name, true); }
    await this.runResult(result, this.t('Deleted {0}.', ref.name));
  }
  private async deleteRemote(ref: GitRef): Promise<void> {
    const slash=ref.name.indexOf('/'); if (slash < 1) throw new Error(this.t('Cannot determine the remote branch.')); const remote=ref.name.slice(0,slash), branch=ref.name.slice(slash+1);
    const remove = this.t('Delete'); const choice=await vscode.window.showWarningMessage(this.t('Delete remote branch?\n\n{0}\n\nThis affects other users.', ref.name),{modal:true},remove); if(choice===remove) await this.runResult(await this.operations.deleteRemoteBranch(remote,branch),this.t('Deleted {0}.', ref.name));
  }
  private async pickRemote(title: string): Promise<string | undefined> { const output=await this.git.run(['remote']); const remotes=output.split('\n').filter(Boolean); return vscode.window.showQuickPick(remotes,{title}); }
  private async runResult(result: import('../git/BranchOperationService').GitCommandResult, success: string): Promise<void> { if (!result.success) throw new Error(result.stderr?.trim() || this.t('Git operation failed.')); this.post({type:'operationResult',message:success}); await this.load(); }
  private localBranchName(ref: string): string {
    this.assertKnownRef(ref);
    const selected = this.refs.find(candidate => candidate.fullName === ref);
    if (selected?.type !== 'localBranch') throw new Error(this.t('Switch and merge operations are available only for local branches.'));
    return selected.name;
  }
  private assertKnownRef(ref: string): void {
    if (!this.refs.some(candidate => candidate.fullName === ref)) {
      throw new Error(this.t('The selected ref no longer exists. Refresh the viewer and try again.'));
    }
  }
  private t(message: string, ...args: Array<string | number | boolean>): string { return vscode.l10n.t(message, ...args); }
  private post(value: unknown) { void this.panel.webview.postMessage(value); }
  private html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
    const nonce = Math.random().toString(36).slice(2);
    return `<!doctype html><html lang="${vscode.env.language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"><title>${this.t('Git Topology')}</title></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}
