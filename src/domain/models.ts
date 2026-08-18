export type RefType = 'localBranch' | 'remoteBranch' | 'tag';
export interface GitRef { name: string; fullName: string; type: RefType; commitId: string }
export interface RefVisibility { tags: boolean; remotes: boolean }
export interface BranchStatus { ref: string; local: boolean; remote: boolean; upstream?: string; ahead?: number; behind?: number }
export interface CommitNode { id: string; parents: string[]; author?: string; date?: string; message?: string; refs: GitRef[] }
export interface CommitGraph { nodes: Map<string, CommitNode>; order: string[] }
export interface RefViewNode { id: string; refs: GitRef[]; lane: number; row: number; x: number; y: number }
export interface RefViewEdge { from: string; to: string }
export interface RefViewGraph { nodes: RefViewNode[]; edges: RefViewEdge[] }
export interface CommitViewNode {
  id: string;
  refs: GitRef[];
  lane: number;
  row: number;
  x: number;
  y: number;
  /** IDs of ordinary linear commits represented by one summary node. */
  commitIds?: string[];
}
export interface CommitViewEdge { from: string; to: string }
export interface CommitViewGraph { nodes: CommitViewNode[]; edges: CommitViewEdge[] }
export interface BranchComparison { left: string; right: string; mode: 'divergence' | 'snapshot'; mergeBases: string[]; ahead: number; behind: number; additions: number; deletions: number; files: ChangedFile[]; onlyLeft: CommitInfo[]; onlyRight: CommitInfo[] }
export interface ChangedFile { status: string; path: string; oldPath?: string; additions?: number; deletions?: number }
export interface CommitInfo { id: string; subject: string; committer?: string; date?: string }
export interface RefLog { ref: string; commits: CommitInfo[]; branchPoint?: CommitInfo }
export interface CommitDetails { commit: CommitInfo; parent?: string; additions: number; deletions: number; files: ChangedFile[] }
export interface GraphPayload { graph: RefViewGraph; significantGraph: CommitViewGraph; minimalGraph?: CommitViewGraph; commitGraph: CommitViewGraph; refs: GitRef[]; branchStatuses: BranchStatus[]; repository: string; currentBranch?: string; compareBase?: string; mergeBaseIds: string[]; focusedRef?: string }
