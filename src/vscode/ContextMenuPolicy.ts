import { GitRef } from '../domain/models';
import { GraphContextMenuItem, GraphMenuCommand } from './messages';

export type GitOperationState = 'normal' | 'merging' | 'rebasing' | 'cherryPicking' | 'reverting';
export interface RepositoryOperationState { type: GitOperationState; hasConflicts: boolean }
export interface MenuContext { ref: GitRef; currentBranch?: string; hasUpstream: boolean; operation: RepositoryOperationState }
export type Translate = (message: string) => string;

export class ContextMenuPolicy {
  comparisonItems(t: Translate = message => message): GraphContextMenuItem[] {
    const item = (command: GraphMenuCommand, label: string): GraphContextMenuItem => ({ command, label, group: 'compare', enabled: true, visible: true });
    return [
      item('compareSelected', t('Compare Selected Refs')),
      item('compareSelectedSnapshots', t('Compare Current Snapshots')),
      item('showSelectedMergeBase', t('Show Merge Base'))
    ];
  }

  branchItems(context: MenuContext, t: Translate = message => message): GraphContextMenuItem[] {
    const { ref, currentBranch, hasUpstream, operation } = context;
    const local = ref.type === 'localBranch';
    const remote = ref.type === 'remoteBranch';
    const current = local && ref.name === currentBranch;
    const normal = operation.type === 'normal';
    const item = (command: GraphMenuCommand, label: string, enabled = true): GraphContextMenuItem => ({ command, label, group: command.startsWith('delete') ? 'manage' : 'git', enabled, visible: true });
    if (!normal) {
      if (operation.type === 'rebasing') return [item('continueRebase', t('Continue Rebase'), operation.hasConflicts === false), item('abortRebase', t('Abort Rebase'))];
      if (operation.type === 'cherryPicking') return [item('continueCherryPick', t('Continue Cherry-pick'), operation.hasConflicts === false), item('abortCherryPick', t('Abort Cherry-pick'))];
      return [];
    }
    if (remote) return [item('checkoutRemote', t('Checkout as Local Branch…')), item('fetch', t('Fetch')), item('deleteRemote', t('Delete Remote Branch…'))];
    if (!local) return [];
    return [
      item('push', hasUpstream ? t('Push') : t('Push and Set Upstream…')),
      item('pull', t('Pull'), current), item('fetch', hasUpstream ? t('Fetch') : t('Fetch…')),
      item('mergeIntoCurrent', t('Merge into Current Branch…'), !current && Boolean(currentBranch)),
      item('rebaseCurrentOnto', t('Rebase Current Branch onto This…'), !current && Boolean(currentBranch)),
      item('deleteLocal', t('Delete Branch…'), !current)
    ];
  }
}
