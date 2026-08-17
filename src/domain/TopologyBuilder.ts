import { CommitGraph, CollapsedCommitRange, ViewGraph, ViewMode, ViewNode } from './models';

const TOP_PADDING = 90;
const ROW_HEIGHT = 110;

export class TopologyBuilder {
  build(graph: CommitGraph, mode: ViewMode, expanded = new Set<string>()): ViewGraph {
    const significant = new Set(graph.order.filter(id => this.isAnchor(graph, id)));
    if (mode === 'compact') graph.order.forEach(id => { const n = graph.nodes.get(id)!; if (n.message) significant.add(id); });
    if (mode === 'full') graph.order.forEach(id => significant.add(id));
    const ranges = this.buildRanges(graph, significant, expanded);
    const visible = new Set(significant);
    ranges.filter(range => range.expanded).forEach(range => range.commits.forEach(id => visible.add(id)));
    const ordered = graph.order.filter(id => visible.has(id));
    const lanes = this.assignLanes(graph, ordered, visible);
    const nodes: ViewNode[] = ordered.map((id, row) => ({ id, kind: 'commit', commit: graph.nodes.get(id), lane: lanes.get(id)!, row, x: 70 + lanes.get(id)! * 150, y: TOP_PADDING + row * ROW_HEIGHT }));
    for (const range of ranges) {
      const fromIndex = ordered.indexOf(range.fromCommit);
      const toIndices = range.toCommits.map(id => ordered.indexOf(id)).filter(index => index >= 0);
      if (fromIndex < 0 || !toIndices.length) continue;
      const row = (fromIndex + Math.max(...toIndices)) / 2;
      const fromLane = lanes.get(range.fromCommit) ?? 0;
      nodes.push({ id: range.id, kind: 'range', range, lane: fromLane, row, x: 70 + fromLane * 150, y: TOP_PADDING + row * ROW_HEIGHT });
    }
    const visibleOrdered = [...nodes].filter(n => n.kind === 'commit').sort((a,b) => a.row-b.row);
    const edges = [] as ViewGraph['edges'];
    for (const node of visibleOrdered) {
      for (const [to, hidden] of this.visibleAncestors(graph, node.commit!.parents, visible)) {
        edges.push({ from: node.id, to, hiddenCommitCount: hidden.size });
      }
    }
    return { nodes, edges };
  }
  private isAnchor(graph: CommitGraph, id: string): boolean {
    const node = graph.nodes.get(id)!;
    return node.refs.length > 0 || node.parents.length === 0 || node.parents.some(parent => !graph.nodes.has(parent));
  }
  private buildRanges(graph: CommitGraph, significant: Set<string>, expanded: Set<string>): CollapsedCommitRange[] {
    return graph.order.flatMap(from => {
      if (!significant.has(from)) return [];
      const region = this.hiddenRegion(graph, graph.nodes.get(from)!.parents, significant);
      if (!region.commits.size || !region.targets.size) return [];
      const commits = graph.order.filter(id => region.commits.has(id));
      const toCommits = graph.order.filter(id => region.targets.has(id));
      const id = `range:${from}:${toCommits.join(',')}`;
      return [{ id, fromCommit: from, toCommits, commits, count: commits.length, expanded: expanded.has(id) }];
    });
  }
  private hiddenRegion(graph: CommitGraph, starts: string[], anchors: Set<string>): { commits: Set<string>; targets: Set<string> } {
    const commits = new Set<string>(), targets = new Set<string>(), pending = [...starts];
    while (pending.length) {
      const id = pending.pop()!;
      if (anchors.has(id)) { targets.add(id); continue; }
      if (!graph.nodes.has(id) || commits.has(id)) continue;
      commits.add(id);
      pending.push(...graph.nodes.get(id)!.parents);
    }
    return { commits, targets };
  }
  private assignLanes(graph: CommitGraph, order: string[], visible: Set<string>): Map<string, number> {
    const result = new Map<string, number>(), active: string[] = [];
    for (const id of order) {
      let lane = active.indexOf(id); if (lane < 0) { lane = active.findIndex(x => !x); if (lane < 0) lane = active.length; }
      result.set(id, lane);
      for (let i = 0; i < active.length; i++) {
        if (i !== lane && active[i] === id) active[i] = '';
      }
      const parents = (graph.nodes.get(id)?.parents ?? [])
        .flatMap(parent => [...this.visibleAncestors(graph, [parent], visible).keys()])
        .filter((parent, index, values) => values.indexOf(parent) === index);
      active[lane] = parents[0] ?? '';
      for (let i = 1; i < parents.length; i++) { let pLane = active.indexOf(parents[i]); if (pLane < 0) { pLane = active.findIndex(x => !x); if (pLane < 0) pLane = active.length; active[pLane] = parents[i]; } }
    }
    return result;
  }
  private visibleAncestors(graph: CommitGraph, starts: string[], visible: Set<string>): Map<string, Set<string>> {
    const targets = new Set<string>(), hidden = new Set<string>(), pending = [...starts];
    while (pending.length) {
      const id = pending.pop()!;
      if (visible.has(id)) {
        targets.add(id);
        continue;
      }
      const node = graph.nodes.get(id);
      if (!node || hidden.has(id)) continue;
      hidden.add(id);
      pending.push(...node.parents);
    }
    return new Map([...targets].map(target => [target, hidden]));
  }
}
