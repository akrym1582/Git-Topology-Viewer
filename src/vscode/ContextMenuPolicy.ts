import { GitRef } from '../domain/models';
import { GraphContextMenuItem, GraphMenuCommand } from './messages';

export type GitOperationState = 'normal' | 'merging' | 'rebasing' | 'cherryPicking' | 'reverting';
export interface RepositoryOperationState { type: GitOperationState; hasConflicts: boolean }
export interface MenuContext { ref: GitRef; currentBranch?: string; hasUpstream: boolean; operation: RepositoryOperationState }

export class ContextMenuPolicy {
  comparisonItems(): GraphContextMenuItem[] {
    const item = (command: GraphMenuCommand, label: string): GraphContextMenuItem => ({ command, label, group: 'compare', enabled: true, visible: true });
    return [
      item('compareSelected', 'Compare Selected Refs'),
      item('compareSelectedSnapshots', 'Compare Current Snapshots'),
      item('showSelectedMergeBase', 'Show Merge Base')
    ];
  }

  branchItems(context: MenuContext): GraphContextMenuItem[] {
    const { ref, currentBranch, hasUpstream, operation } = context;
    const local = ref.type === 'localBranch';
    const remote = ref.type === 'remoteBranch';
    const current = local && ref.name === currentBranch;
    const normal = operation.type === 'normal';
    const item = (command: GraphMenuCommand, label: string, enabled = true): GraphContextMenuItem => ({ command, label, group: command.startsWith('delete') ? 'manage' : 'git', enabled, visible: true });
    if (!normal) {
      if (operation.type === 'rebasing') return [item('continueRebase', 'Continue Rebase', operation.hasConflicts === false), item('abortRebase', 'Abort Rebase')];
      if (operation.type === 'cherryPicking') return [item('continueCherryPick', 'Continue Cherry-pick', operation.hasConflicts === false), item('abortCherryPick', 'Abort Cherry-pick')];
      return [];
    }
    if (remote) return [item('checkoutRemote', 'Checkout as Local Branch…'), item('fetch', 'Fetch'), item('deleteRemote', 'Delete Remote Branch…')];
    if (!local) return [];
    return [
      item('push', hasUpstream ? 'Push' : 'Push and Set Upstream…'),
      item('pull', 'Pull', current), item('fetch', hasUpstream ? 'Fetch' : 'Fetch…'),
      item('mergeIntoCurrent', 'Merge into Current Branch…', !current && Boolean(currentBranch)),
      item('rebaseCurrentOnto', 'Rebase Current Branch onto This…', !current && Boolean(currentBranch)),
      item('deleteLocal', 'Delete Branch…', !current)
    ];
  }
}
