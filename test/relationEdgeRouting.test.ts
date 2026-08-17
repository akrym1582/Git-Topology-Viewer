import { describe, expect, it } from 'vitest';
import { relationEdgePath } from '../src/webview/relationEdgeRouting';

describe('relationEdgePath', () => {
  it('uses separate target ports for relations that converge on one ref group', () => {
    const first = relationEdgePath({ x: 321, y: 224 }, { x: 131, y: 436 }, 0, 2);
    const second = relationEdgePath({ x: 321, y: 344 }, { x: 131, y: 436 }, 1, 2);

    expect(first).toContain('111 436');
    expect(second).toContain('151 436');
    expect(first).not.toBe(second);
  });

  it('keeps a single relation centred on its target group', () => {
    expect(relationEdgePath({ x: 61, y: 118 }, { x: 251, y: 210 }, 0, 1)).toContain('251 210');
  });
});
