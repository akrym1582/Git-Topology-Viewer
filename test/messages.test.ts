import { describe, expect, it } from 'vitest';
import { isWebviewRequest } from '../src/vscode/messages';

describe('isWebviewRequest', () => {
  it('accepts complete requests', () => {
    expect(isWebviewRequest({ type: 'setRefVisibility', tags: true, remotes: false })).toBe(true);
    expect(isWebviewRequest({ type: 'showRefLog', ref: 'refs/heads/main' })).toBe(true);
    expect(isWebviewRequest({ type: 'showCommitDetails', commit: 'f41acde1234567890' })).toBe(true);
    expect(isWebviewRequest({ type: 'showCommitGroupDetails', commits: ['f41acde1234567890', 'e93b2101234567890'] })).toBe(true);
    expect(isWebviewRequest({ type: 'switchBranch', ref: 'refs/heads/topic' })).toBe(true);
    expect(isWebviewRequest({ type: 'mergeBranch', ref: 'refs/heads/topic' })).toBe(true);
    expect(isWebviewRequest({ type: 'contextMenu', nodeType: 'branch', nodeId: 'refs/heads/topic', selectedRefs: ['refs/heads/main', 'refs/heads/topic'], x: 10, y: 20 })).toBe(true);
    expect(isWebviewRequest({ type: 'runContextCommand', command: 'compareSelected', nodeType: 'branch', nodeId: 'refs/heads/topic', selectedRefs: ['refs/heads/main', 'refs/heads/topic'] })).toBe(true);
    expect(isWebviewRequest({ type: 'runContextCommand', command: 'showMergeBase', nodeType: 'branch', nodeId: 'refs/heads/topic' })).toBe(true);
    expect(isWebviewRequest({ type: 'contextMenu', nodeType: 'commit', nodeId: 'f41acde1234567890', selectedRefs: [], x: 10, y: 20 })).toBe(true);
    expect(isWebviewRequest({ type: 'runContextCommand', command: 'copyMessage', nodeType: 'commit', nodeId: 'f41acde1234567890', selectedRefs: [] })).toBe(true);
    expect(isWebviewRequest({
      type: 'openDiff', left: 'refs/heads/topic', right: 'refs/heads/main',
      path: 'new name.ts', oldPath: 'old name.ts', status: 'R'
    })).toBe(true);
  });

  it('rejects malformed and stale requests', () => {
    expect(isWebviewRequest({ type: 'setViewMode', mode: 'invalid' })).toBe(false);
    expect(isWebviewRequest({ type: 'setRefVisibility', tags: true })).toBe(false);
    expect(isWebviewRequest({ type: 'openDiff', left: 'main', right: 'base', path: 'file' })).toBe(false);
    expect(isWebviewRequest({ type: 'copy', value: 42 })).toBe(false);
    expect(isWebviewRequest({ type: 'expandRange', rangeId: 'range:main' })).toBe(false);
    expect(isWebviewRequest({ type: 'showRefLog', ref: '' })).toBe(false);
    expect(isWebviewRequest({ type: 'showCommitDetails', commit: 'not-a-commit' })).toBe(false);
    expect(isWebviewRequest({ type: 'showCommitGroupDetails', commits: [] })).toBe(false);
    expect(isWebviewRequest({ type: 'showCommitGroupDetails', commits: ['f41acde1234567890', 'f41acde1234567890'] })).toBe(false);
    expect(isWebviewRequest({ type: 'contextMenu', nodeType: 'branch', nodeId: 'refs/heads/topic', selectedRefs: [], x: 10, y: 20 })).toBe(false);
    expect(isWebviewRequest({ type: 'contextMenu', nodeType: 'branch', nodeId: 'refs/heads/topic', selectedRefs: ['refs/heads/main', 'refs/heads/main'], x: 10, y: 20 })).toBe(false);
    expect(isWebviewRequest({ type: 'runContextCommand', command: 'delete', nodeType: 'branch', nodeId: 'refs/heads/main' })).toBe(false);
    expect(isWebviewRequest({ type: 'contextMenu', nodeType: 'commit', nodeId: 'f41acde1234567890', selectedRefs: ['refs/heads/main'], x: 10, y: 20 })).toBe(false);
    expect(isWebviewRequest({ type: 'runContextCommand', command: 'copyHash', nodeType: 'commit', nodeId: 'not-a-commit', selectedRefs: [] })).toBe(false);
    expect(isWebviewRequest(null)).toBe(false);
  });
});
