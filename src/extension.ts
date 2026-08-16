import * as vscode from 'vscode';
import { GitExecutableResolver } from './git/GitExecutableResolver';
import { GitClient } from './git/GitClient';
import { DiffService } from './git/DiffService';
import { GitContentProvider } from './vscode/GitContentProvider';
import { TopologyPanel } from './vscode/TopologyPanel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('gitTopology.open', async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return void vscode.window.showWarningMessage('Open a folder containing a Git repository first.');
    try {
      const executable = await GitExecutableResolver.resolve(root); const git = new GitClient(executable.path, root);
      await git.run(['rev-parse', '--show-toplevel']);
      context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(GitContentProvider.scheme, new GitContentProvider(new DiffService(git))));
      TopologyPanel.show(git, root, context.extensionUri);
    } catch (e) { void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e), 'Open Settings').then(x => x && vscode.commands.executeCommand('workbench.action.openSettings', 'gitTopology.gitPath')); }
  }));
}
export function deactivate() {}
