export interface Point {
  x: number;
  y: number;
}

const MAX_APPROACH_HEIGHT = 72;

/**
 * Holds a relation edge in its source lane until the target approach.
 * Converging relations share the target group's central anchor.
 */
export function relationEdgePath(from: Point, to: Point): string {
  const verticalDistance = Math.max(0, to.y - from.y);
  const approachHeight = Math.min(MAX_APPROACH_HEIGHT, verticalDistance / 2);
  const turnY = to.y - approachHeight;
  const curveY = turnY + approachHeight / 2;
  return `M ${from.x} ${from.y} L ${from.x} ${turnY} C ${from.x} ${curveY}, ${to.x} ${curveY}, ${to.x} ${to.y}`;
}
