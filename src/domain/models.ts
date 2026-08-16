export type RefType = 'localBranch' | 'remoteBranch' | 'tag';
export interface GitRef { name: string; fullName: string; type: RefType; commitId: string }
export interface BranchStatus { ref: string; local: boolean; remote: boolean; upstream?: string; ahead?: number; behind?: number }
export interface CommitNode { id: string; parents: string[]; author?: string; date?: string; message?: string; refs: GitRef[] }
export interface CommitGraph { nodes: Map<string, CommitNode>; order: string[] }
export interface GraphEdge { from: string; to: string; hiddenCommits: string[]; hiddenCommitCount: number }
export interface CollapsedCommitRange { id: string; fromCommit: string; toCommit: string; commits: string[]; count: number; expanded: boolean }
export type ViewMode = 'topology' | 'compact' | 'full';
export interface ViewNode { id: string; kind: 'commit' | 'range'; commit?: CommitNode; range?: CollapsedCommitRange; lane: number; row: number; x: number; y: number }
export interface ViewEdge { from: string; to: string; hiddenCommitCount: number }
export interface ViewGraph { nodes: ViewNode[]; edges: ViewEdge[] }
export interface BranchComparison { left: string; right: string; mode: 'divergence' | 'snapshot'; mergeBases: string[]; ahead: number; behind: number; additions: number; deletions: number; files: ChangedFile[]; onlyLeft: CommitInfo[]; onlyRight: CommitInfo[] }
export interface ChangedFile { status: string; path: string; oldPath?: string; additions?: number; deletions?: number }
export interface CommitInfo { id: string; subject: string }
export interface RefLog { ref: string; commits: CommitInfo[] }
export interface CommitDetails { commit: CommitInfo; parent?: string; additions: number; deletions: number; files: ChangedFile[] }
export interface GraphPayload { graph: ViewGraph; refs: GitRef[]; branchStatuses: BranchStatus[]; repository: string; currentBranch?: string; compareBase?: string; mergeBaseIds: string[]; focusedRef?: string; mode: ViewMode; expandedRangeIds: string[] }
