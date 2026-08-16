import { ViewMode } from '../domain/models';

type ComparisonMode = 'divergence' | 'snapshot';
type ChangedFileStatus = 'A' | 'D' | 'M' | 'R' | 'C' | 'T' | 'U' | 'X' | 'B';

export type WebviewRequest =
  | { type: 'refresh' }
  | { type: 'setViewMode'; mode: ViewMode }
  | { type: 'expandRange'; rangeId: string }
  | { type: 'compareRefs'; left: string; right: string; mode: ComparisonMode }
  | { type: 'openDiff'; left: string; right: string; path: string; oldPath?: string; status: ChangedFileStatus }
  | { type: 'copy'; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
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
    case 'compareRefs':
      return isString(value.left) && isString(value.right)
        && (value.mode === 'divergence' || value.mode === 'snapshot');
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
