import { CommitGraph, CollapsedCommitRange, ViewGraph, ViewMode, ViewNode } from './models';

export class TopologyBuilder {
  build(graph: CommitGraph, mode: ViewMode, expanded = new Set<string>()): ViewGraph {
    const children = new Map<string, number>();
    graph.nodes.forEach(n => n.parents.forEach(p => children.set(p, (children.get(p) ?? 0) + 1)));
    const significant = new Set(graph.order.filter(id => { const n = graph.nodes.get(id)!; return n.refs.length > 0 || n.parents.length !== 1 || (children.get(id) ?? 0) !== 1; }));
    if (mode === 'compact') graph.order.forEach(id => { const n = graph.nodes.get(id)!; if (n.message) significant.add(id); });
    if (mode === 'full') graph.order.forEach(id => significant.add(id));
    const visible = new Set(significant); const ranges: CollapsedCommitRange[] = [];
    for (const from of graph.order) {
      if (!significant.has(from)) continue;
      for (const parent of graph.nodes.get(from)!.parents) {
        const hidden: string[] = []; let cursor = parent;
        while (graph.nodes.has(cursor) && !significant.has(cursor)) { hidden.push(cursor); const ps = graph.nodes.get(cursor)!.parents; if (ps.length !== 1) break; cursor = ps[0]; }
        if (hidden.length) {
          const id = `range:${from}:${cursor}`; const range = { id, fromCommit: from, toCommit: cursor, commits: hidden, count: hidden.length, expanded: expanded.has(id) };
          ranges.push(range); if (range.expanded) hidden.forEach(x => visible.add(x));
        }
      }
    }
    const ordered = graph.order.filter(id => visible.has(id));
    const lanes = this.assignLanes(graph, ordered); const nodes: ViewNode[] = ordered.map((id, row) => ({ id, kind: 'commit', commit: graph.nodes.get(id), lane: lanes.get(id)!, row, x: 70 + lanes.get(id)! * 150, y: 44 + row * 74 }));
    for (const range of ranges.filter(r => !r.expanded)) {
      const fromIndex = ordered.indexOf(range.fromCommit); const toIndex = ordered.indexOf(range.toCommit);
      if (fromIndex < 0 || toIndex < 0) continue;
      const row = (fromIndex + toIndex) / 2; const lane = lanes.get(range.fromCommit) ?? 0;
      nodes.push({ id: range.id, kind: 'range', range, lane, row, x: 70 + lane * 150, y: 44 + row * 74 });
    }
    const visibleOrdered = [...nodes].filter(n => n.kind === 'commit').sort((a,b) => a.row-b.row);
    const edges = [] as ViewGraph['edges'];
    for (const node of visibleOrdered) for (const parent of node.commit!.parents) {
      let cursor = parent, hidden = 0;
      while (graph.nodes.has(cursor) && !visible.has(cursor)) { hidden++; const ps = graph.nodes.get(cursor)!.parents; if (ps.length !== 1) break; cursor = ps[0]; }
      if (visible.has(cursor)) edges.push({ from: node.id, to: cursor, hiddenCommitCount: hidden });
    }
    return { nodes, edges };
  }
  private assignLanes(graph: CommitGraph, order: string[]): Map<string, number> {
    const result = new Map<string, number>(), active: string[] = [];
    for (const id of order) {
      let lane = active.indexOf(id); if (lane < 0) { lane = active.findIndex(x => !x); if (lane < 0) lane = active.length; }
      result.set(id, lane); const parents = graph.nodes.get(id)?.parents ?? []; active[lane] = parents[0] ?? '';
      for (let i = 1; i < parents.length; i++) { let pLane = active.indexOf(parents[i]); if (pLane < 0) { pLane = active.findIndex(x => !x); if (pLane < 0) pLane = active.length; active[pLane] = parents[i]; } }
    }
    return result;
  }
}
