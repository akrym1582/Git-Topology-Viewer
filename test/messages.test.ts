import { describe, expect, it } from 'vitest';
import { isWebviewRequest } from '../src/vscode/messages';

describe('isWebviewRequest', () => {
  it('accepts complete requests', () => {
    expect(isWebviewRequest({ type: 'setViewMode', mode: 'topology' })).toBe(true);
    expect(isWebviewRequest({ type: 'showRefLog', ref: 'refs/heads/main' })).toBe(true);
    expect(isWebviewRequest({
      type: 'openDiff', left: 'refs/heads/topic', right: 'refs/heads/main',
      path: 'new name.ts', oldPath: 'old name.ts', status: 'R'
    })).toBe(true);
  });

  it('rejects malformed and stale requests', () => {
    expect(isWebviewRequest({ type: 'setViewMode', mode: 'invalid' })).toBe(false);
    expect(isWebviewRequest({ type: 'openDiff', left: 'main', right: 'base', path: 'file' })).toBe(false);
    expect(isWebviewRequest({ type: 'copy', value: 42 })).toBe(false);
    expect(isWebviewRequest({ type: 'showRefLog', ref: '' })).toBe(false);
    expect(isWebviewRequest(null)).toBe(false);
  });
});
