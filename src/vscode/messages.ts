import { ViewMode } from '../domain/models';

export type GraphMenuCommand = 'compareCurrent' | 'selectCompareBase' | 'compareBase' | 'compareWith' | 'showMergeBase' | 'showChangedFiles' | 'compareSelected' | 'compareSelectedSnapshots' | 'showSelectedMergeBase' | 'focus' | 'related' | 'expandCommits' | 'collapseCommits' | 'checkout' | 'createBranch' | 'copyName' | 'copyHash' | 'push' | 'pull' | 'fetch' | 'checkoutRemote' | 'mergeIntoCurrent' | 'rebaseCurrentOnto' | 'deleteLocal' | 'deleteRemote' | 'continueRebase' | 'abortRebase' | 'continueCherryPick' | 'abortCherryPick';
export interface GraphContextMenuItem { command: GraphMenuCommand; label: string; enabled: boolean; visible: boolean; group: 'compare' | 'graph' | 'git' | 'manage' | 'copy' }

type ComparisonMode = 'divergence' | 'snapshot';
type ChangedFileStatus = 'A' | 'D' | 'M' | 'R' | 'C' | 'T' | 'U' | 'X' | 'B';

export type WebviewRequest =
  | { type: 'refresh' }
  | { type: 'setViewMode'; mode: ViewMode }
  | { type: 'expandRange'; rangeId: string }
  | { type: 'contextMenu'; nodeType: 'branch' | 'remoteBranch' | 'tag' | 'commit'; nodeId: string; selectedRefs: string[]; x: number; y: number }
  | { type: 'runContextCommand'; command: GraphMenuCommand; nodeId: string; selectedRefs?: string[] }
  | { type: 'compareRefs'; left: string; right: string; mode: ComparisonMode }
  | { type: 'showRefLog'; ref: string }
  | { type: 'showCommitDetails'; commit: string }
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

function isRefSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 2
    && value.every(isString) && new Set(value).size === value.length;
}

export function isWebviewRequest(value: unknown): value is WebviewRequest {
  if (!isRecord(value) || !isString(value.type)) return false;
  switch (value.type) {
    case 'refresh':
      return true;
    case 'setViewMode':
      return value.mode === 'topology' || value.mode === 'compact' || value.mode === 'full';
    case 'expandRange':
      return isString(value.rangeId);
    case 'contextMenu':
      return (value.nodeType === 'branch' || value.nodeType === 'remoteBranch' || value.nodeType === 'tag' || value.nodeType === 'commit')
        && isString(value.nodeId) && isRefSelection(value.selectedRefs) && typeof value.x === 'number' && typeof value.y === 'number';
    case 'runContextCommand':
      return isString(value.nodeId) && (value.selectedRefs === undefined || isRefSelection(value.selectedRefs))
        && ['compareCurrent','selectCompareBase','compareBase','compareWith','showMergeBase','showChangedFiles','compareSelected','compareSelectedSnapshots','showSelectedMergeBase','focus','related','expandCommits','collapseCommits','checkout','createBranch','copyName','copyHash','push','pull','fetch','checkoutRemote','mergeIntoCurrent','rebaseCurrentOnto','deleteLocal','deleteRemote','continueRebase','abortRebase','continueCherryPick','abortCherryPick'].includes(String(value.command));
    case 'compareRefs':
      return isString(value.left) && isString(value.right)
        && (value.mode === 'divergence' || value.mode === 'snapshot');
    case 'showRefLog':
      return isString(value.ref);
    case 'showCommitDetails':
      return isCommitId(value.commit);
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
