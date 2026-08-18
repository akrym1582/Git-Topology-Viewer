import { describe, expect, it } from 'vitest';
import { relationEdgePath } from '../src/webview/relationEdgeRouting';

describe('relationEdgePath', () => {
  it('converges relations at the same target port', () => {
    const first = relationEdgePath({ x: 321, y: 224 }, { x: 131, y: 436 });
    const second = relationEdgePath({ x: 321, y: 344 }, { x: 131, y: 436 });

    expect(first).toBe('M 321 224 L 321 364 C 321 400, 131 400, 131 436');
    expect(second).toBe('M 321 344 L 321 390 C 321 413, 131 413, 131 436');
    expect(first).not.toBe(second);
  });

  it('keeps a long relation in its source lane until the target approach', () => {
    expect(relationEdgePath({ x: 131, y: 104 }, { x: 511, y: 316 })).toBe(
      'M 131 104 L 131 244 C 131 280, 511 280, 511 316',
    );
  });

  it('keeps a single relation centred on its target group', () => {
    expect(relationEdgePath({ x: 61, y: 118 }, { x: 251, y: 210 })).toContain('251 210');
  });
});
