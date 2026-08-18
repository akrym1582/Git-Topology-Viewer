export type GraphNodeType = 'branch' | 'remoteBranch' | 'tag' | 'commit';
export type GraphMenuCommand = 'compareCurrent' | 'selectCompareBase' | 'compareBase' | 'compareWith' | 'showMergeBase' | 'showChangedFiles' | 'showChanges' | 'compareSelected' | 'compareSelectedSnapshots' | 'showSelectedMergeBase' | 'focus' | 'related' | 'checkout' | 'checkoutDetached' | 'createBranch' | 'createTag' | 'cherryPick' | 'revert' | 'copyName' | 'copyHash' | 'copyMessage' | 'push' | 'pull' | 'fetch' | 'checkoutRemote' | 'mergeIntoCurrent' | 'rebaseCurrentOnto' | 'deleteLocal' | 'deleteRemote' | 'continueRebase' | 'abortRebase' | 'continueCherryPick' | 'abortCherryPick';
export interface GraphContextMenuItem { command: GraphMenuCommand; label: string; enabled: boolean; visible: boolean; group: 'compare' | 'graph' | 'git' | 'manage' | 'copy' }

type ComparisonMode = 'divergence' | 'snapshot';
type ChangedFileStatus = 'A' | 'D' | 'M' | 'R' | 'C' | 'T' | 'U' | 'X' | 'B';

export type WebviewRequest =
  | { type: 'refresh' }
  | { type: 'setRefVisibility'; tags: boolean; remotes: boolean }
  | { type: 'contextMenu'; nodeType: GraphNodeType; nodeId: string; selectedRefs: string[]; x: number; y: number }
  | { type: 'runContextCommand'; command: GraphMenuCommand; nodeType: GraphNodeType; nodeId: string; selectedRefs?: string[] }
  | { type: 'compareRefs'; left: string; right: string; mode: ComparisonMode }
  | { type: 'showRefLog'; ref: string }
  | { type: 'showCommitDetails'; commit: string }
  | { type: 'showCommitGroupDetails'; commits: string[] }
  | { type: 'switchBranch'; ref: string }
  | { type: 'mergeBranch'; ref: string }
  | { type: 'openDiff'; left: string; right: string; path: string; oldPath?: string; status: ChangedFileStatus }
  | { type: 'copy'; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCommitId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value);
}

function isCommitIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 10000
    && value.every(isCommitId) && new Set(value).size === value.length;
}

function isRefSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 2
    && value.every(isString) && new Set(value).size === value.length;
}

const menuCommands: GraphMenuCommand[] = ['compareCurrent','selectCompareBase','compareBase','compareWith','showMergeBase','showChangedFiles','showChanges','compareSelected','compareSelectedSnapshots','showSelectedMergeBase','focus','related','checkout','checkoutDetached','createBranch','createTag','cherryPick','revert','copyName','copyHash','copyMessage','push','pull','fetch','checkoutRemote','mergeIntoCurrent','rebaseCurrentOnto','deleteLocal','deleteRemote','continueRebase','abortRebase','continueCherryPick','abortCherryPick'];

export function isWebviewRequest(value: unknown): value is WebviewRequest {
  if (!isRecord(value) || !isString(value.type)) return false;
  switch (value.type) {
    case 'refresh':
      return true;
    case 'setRefVisibility':
      return typeof value.tags === 'boolean' && typeof value.remotes === 'boolean';
    case 'contextMenu':
      return (value.nodeType === 'commit'
        ? isCommitId(value.nodeId) && Array.isArray(value.selectedRefs) && value.selectedRefs.length === 0
        : (value.nodeType === 'branch' || value.nodeType === 'remoteBranch' || value.nodeType === 'tag')
          && isString(value.nodeId) && isRefSelection(value.selectedRefs))
        && typeof value.x === 'number' && typeof value.y === 'number';
    case 'runContextCommand':
      return (value.nodeType === 'commit' ? isCommitId(value.nodeId) : (value.nodeType === 'branch' || value.nodeType === 'remoteBranch' || value.nodeType === 'tag') && isString(value.nodeId))
        && (value.selectedRefs === undefined || (value.nodeType === 'commit' ? Array.isArray(value.selectedRefs) && value.selectedRefs.length === 0 : isRefSelection(value.selectedRefs)))
        && menuCommands.includes(value.command as GraphMenuCommand);
    case 'compareRefs':
      return isString(value.left) && isString(value.right)
        && (value.mode === 'divergence' || value.mode === 'snapshot');
    case 'showRefLog':
      return isString(value.ref);
    case 'showCommitDetails':
      return isCommitId(value.commit);
    case 'showCommitGroupDetails':
      return isCommitIds(value.commits);
    case 'switchBranch':
    case 'mergeBranch':
      return isString(value.ref);
    case 'openDiff':
      return isString(value.left) && isString(value.right) && isString(value.path)
        && (value.oldPath === undefined || isString(value.oldPath))
        && typeof value.status === 'string' && /^[ADMRCTUXB]$/.test(value.status);
    case 'copy':
      return typeof value.value === 'string';
    default:
      return false;
  }
}
