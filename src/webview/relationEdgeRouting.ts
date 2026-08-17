export interface Point { x: number; y: number }
export interface RelationEdgeSource { from: string }

const TARGET_PORT_SPACING = 40;
const MAX_TARGET_PORT_OFFSET = 48;

/**
 * Routes a relation edge outside its ref labels. Incoming edges are given
 * separate ports so that multiple relations ending at one ref group do not
 * look like a single doubled line.
 */
export function relationEdgePath(
  from: Point,
  to: Point,
  incomingIndex: number,
  incomingCount: number
): string {
  const offset = targetPortOffset(incomingIndex, incomingCount);
  const targetX = to.x + offset;
  const verticalDistance = Math.max(0, to.y - from.y);
  const bend = Math.max(18, verticalDistance * 0.38);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + bend}, ${targetX} ${to.y - bend}, ${targetX} ${to.y}`;
}

/** Keeps incoming port order aligned with the horizontal order of their sources. */
export function orderIncomingRelationEdges<T extends RelationEdgeSource>(edges: readonly T[], sources: ReadonlyMap<string, Point>): T[] {
  return [...edges].sort((left, right) => {
    const leftPoint = sources.get(left.from);
    const rightPoint = sources.get(right.from);
    return (leftPoint?.x ?? 0) - (rightPoint?.x ?? 0)
      || (leftPoint?.y ?? 0) - (rightPoint?.y ?? 0)
      || left.from.localeCompare(right.from);
  });
}

function targetPortOffset(incomingIndex: number, incomingCount: number): number {
  const centeredIndex = incomingIndex - (incomingCount - 1) / 2;
  return Math.max(-MAX_TARGET_PORT_OFFSET, Math.min(MAX_TARGET_PORT_OFFSET, centeredIndex * TARGET_PORT_SPACING));
}
