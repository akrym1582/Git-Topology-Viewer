const commits = { main: 'f41acde1234567890', release: 'c81d0451234567890', feature: 'a772b901234567890', develop: '91bd1201234567890' };
function gitRef(name, type, commitId) { const prefix = type === 'tag' ? 'refs/tags/' : type === 'remoteBranch' ? 'refs/remotes/' : 'refs/heads/'; return { name, fullName: `${prefix}${name}`, type, commitId }; }

const refs = [
  gitRef('main', 'localBranch', commits.main), gitRef('v1.2.0', 'tag', commits.release), gitRef('feature/login', 'localBranch', commits.feature), gitRef('develop', 'localBranch', commits.develop),
  gitRef('origin/HEAD', 'remoteBranch', commits.release), gitRef('origin/release', 'remoteBranch', commits.release)
];
const graph = {
  nodes: [
    { id: commits.main, lane: 0, row: 0, x: 70, y: 90, refs: [refs[0]] },
    { id: commits.develop, lane: 1, row: 1, x: 260, y: 210, refs: [refs[3]] },
    { id: commits.feature, lane: 2, row: 2, x: 450, y: 330, refs: [refs[2]] },
    { id: commits.release, lane: 2, row: 3, x: 450, y: 450, refs: [refs[1], refs[4], refs[5]] }
  ],
  edges: [
    { from: commits.main, to: commits.feature }, { from: commits.develop, to: commits.feature }, { from: commits.feature, to: commits.release }
  ]
};

const commitGraph = {
  nodes: [
    { id: commits.main, lane: 0, row: 0, x: 70, y: 70, refs: [refs[0]] },
    { id: 'e93b2101234567890', lane: 0, row: 1, x: 70, y: 134, refs: [] },
    { id: commits.feature, lane: 1, row: 2, x: 250, y: 198, refs: [refs[2]] },
    { id: 'b16a9821234567890', lane: 1, row: 3, x: 250, y: 262, refs: [] },
    { id: 'c16a9821234567890', lane: 1, row: 4, x: 250, y: 326, refs: [] },
    { id: 'd16a9821234567890', lane: 1, row: 5, x: 250, y: 390, refs: [] },
    { id: 'e16a9821234567890', lane: 1, row: 6, x: 250, y: 454, refs: [] },
    { id: 'f16a9821234567890', lane: 1, row: 7, x: 250, y: 518, refs: [] },
    { id: commits.release, lane: 0, row: 8, x: 70, y: 582, refs: [refs[1], refs[4], refs[5]] },
    { id: commits.develop, lane: 0, row: 9, x: 70, y: 646, refs: [refs[3]] }
  ],
  edges: [
    { from: commits.main, to: 'e93b2101234567890' }, { from: 'e93b2101234567890', to: commits.release }, { from: 'e93b2101234567890', to: commits.feature },
    { from: commits.feature, to: 'b16a9821234567890' }, { from: 'b16a9821234567890', to: 'c16a9821234567890' }, { from: 'c16a9821234567890', to: 'd16a9821234567890' }, { from: 'd16a9821234567890', to: 'e16a9821234567890' }, { from: 'e16a9821234567890', to: 'f16a9821234567890' }, { from: 'f16a9821234567890', to: commits.release }, { from: commits.release, to: commits.develop }
  ]
};

function buildMinimalGraph(graph) { const hidden = new Set(['b16a9821234567890', 'c16a9821234567890', 'd16a9821234567890', 'e16a9821234567890']); return { nodes: graph.nodes.filter(node => node.refs.length || node.id === 'e93b2101234567890'), edges: graph.edges.filter(edge => !hidden.has(edge.from) && !hidden.has(edge.to)).filter(edge => !(edge.from === commits.feature && edge.to === commits.release)).concat({ from: commits.feature, to: commits.release }) }; }

function dispatchGraph(tags = true, remotes = false, includeCommitGraph = true, includeSignificantGraph = true) { const visible = nodeRefs => nodeRefs.filter(item => item.type === 'localBranch' || (item.type === 'tag' && tags) || (item.type === 'remoteBranch' && remotes)); const filteredGraph = { ...graph, nodes: graph.nodes.map(node => ({ ...node, refs: visible(node.refs) })).filter(node => node.refs.length) }; const filteredCommitGraph = { ...commitGraph, nodes: commitGraph.nodes.map(node => ({ ...node, refs: visible(node.refs) })) }; const groupIds = ['b16a9821234567890', 'c16a9821234567890', 'd16a9821234567890', 'e16a9821234567890', 'f16a9821234567890']; const groupId = `commit-group:${groupIds.join(':')}`; const significantGraph = { nodes: filteredCommitGraph.nodes.filter(node => node.refs.length || node.id === 'e93b2101234567890').concat({ id: groupId, lane: 1, row: 3, x: 250, y: 262, refs: [], commitIds: groupIds }), edges: filteredCommitGraph.edges.filter(edge => !groupIds.includes(edge.from) && !groupIds.includes(edge.to)).filter(edge => !(edge.from === commits.feature && edge.to === commits.release)).concat({ from: commits.feature, to: groupId }, { from: groupId, to: commits.release }) }; const payload = { repository: 'commerce-platform', currentBranch: 'main', branchStatuses: [{ ref: 'refs/heads/main', local: true, remote: false }, { ref: 'refs/heads/feature/login', local: true, remote: false }, { ref: 'refs/heads/develop', local: true, remote: false }], refs, graph: filteredGraph, minimalGraph: buildMinimalGraph(filteredCommitGraph), ...(includeSignificantGraph ? { significantGraph } : {}) }; if (includeCommitGraph) payload.commitGraph = filteredCommitGraph; window.dispatchEvent(new MessageEvent('message', { data: { type: 'graph', payload } })); }
window.__dispatchGraph = dispatchGraph;
setTimeout(() => dispatchGraph(), 50);

let handledVisibilityRequests = 0;
setInterval(() => { const requests = window.__vscodeMessages.filter(message => message?.type === 'setRefVisibility'); if (requests.length <= handledVisibilityRequests) return; const request = requests[handledVisibilityRequests++]; dispatchGraph(request.tags, request.remotes); }, 20);

window.__smokeComparison = { type: 'comparison', payload: { left: 'refs/heads/main', right: 'refs/heads/develop', mode: 'divergence', mergeBases: [commits.release], ahead: 12, behind: 3, additions: 532, deletions: 128, files: [{ status: 'M', path: 'src/AuthService.ts' }, { status: 'A', path: 'src/LoginService.ts' }, { status: 'D', path: 'src/OldLoginService.ts' }], onlyLeft: [], onlyRight: [] } };
window.__smokeMainLog = { type: 'refLog', payload: { ref: 'refs/heads/main', commits: [{ id: commits.main, subject: 'Polish relationship view', committer: 'Release Bot', date: '2025-01-04T03:04:05+09:00' }, { id: 'e93b2101234567890', subject: 'Merge feature/login', committer: 'Merge Bot', date: '2025-01-03T03:04:05+09:00' }] } };
window.__smokeFeatureLog = { type: 'refLog', payload: { ref: 'refs/heads/feature/login', branchPoint: { id: commits.release, subject: 'Release baseline', committer: 'Release Bot', date: '2025-01-02T03:04:05+09:00' }, commits: [{ id: commits.feature, subject: 'Improve login flow', committer: 'Feature Bot', date: '2025-01-03T03:04:05+09:00' }] } };
window.__smokeCommitDetails = { type: 'commitDetails', payload: { commit: { id: commits.main, subject: 'Polish relationship view' }, parent: 'e93b2101234567890', additions: 14, deletions: 2, files: [{ status: 'M', path: 'src/AuthService.ts', additions: 10, deletions: 2 }, { status: 'A', path: 'src/LoginService.ts', additions: 4, deletions: 0 }] } };
window.__smokeGroupCommitSummaries = { type: 'commitGroupDetails', payload: { commits: [
  { id: 'b16a9821234567890', subject: 'Add login validation', committer: 'Feature Bot', date: '2025-01-04T03:04:05+09:00' }, { id: 'c16a9821234567890', subject: 'Add login form', committer: 'Feature Bot', date: '2025-01-03T03:04:05+09:00' },
  { id: 'd16a9821234567890', subject: 'Connect login form', committer: 'Feature Bot', date: '2025-01-02T03:04:05+09:00' }, { id: 'e16a9821234567890', subject: 'Polish login errors', committer: 'Feature Bot', date: '2025-01-01T03:04:05+09:00' },
  { id: 'f16a9821234567890', subject: 'Add login tests', committer: 'Feature Bot', date: '2024-12-31T03:04:05+09:00' }
] } };
window.__smokeGroupCommitDetails = { type: 'commitDetails', payload: { commit: { id: 'b16a9821234567890', subject: 'Add login validation' }, parent: 'c16a9821234567890', additions: 3, deletions: 1, files: [{ status: 'M', path: 'src/LoginForm.tsx', additions: 3, deletions: 1 }] } };
window.__smokeSecondGroupCommitDetails = { type: 'commitDetails', payload: { commit: { id: 'c16a9821234567890', subject: 'Add login form' }, parent: 'd16a9821234567890', additions: 5, deletions: 2, files: [{ status: 'A', path: 'src/LoginDialog.tsx', additions: 5, deletions: 0 }] } };

let handledMenuRequests = 0;
setInterval(() => {
  const requests = window.__vscodeMessages.filter(message => message?.type === 'contextMenu');
  if (requests.length <= handledMenuRequests) return;
  const request = requests[handledMenuRequests++];
  const isCurrent = request.nodeId === 'refs/heads/main';
  const isCommit = request.nodeType === 'commit';
  const isPair = request.selectedRefs?.length === 2;
  const item = (command, label, group, enabled = true) => ({ command, label, group, enabled, visible: true });
  const items = isCommit ? [item('showChanges', '変更を表示', 'compare'), item('compareCurrent', '現在のブランチと比較', 'compare'), item('compareBase', '選択した比較ベースと比較', 'compare'), item('compareWith', '比較対象を選択…', 'compare'), item('showMergeBase', 'マージベースを表示', 'compare'), item('checkoutDetached', 'チェックアウト（Detached）', 'git'), item('createBranch', 'ここからブランチを作成…', 'git'), item('createTag', 'タグを作成…', 'git'), item('cherryPick', 'チェリーピック', 'git'), item('revert', 'リバート', 'git'), item('copyHash', 'コミットハッシュをコピー', 'copy'), item('copyMessage', 'コミットメッセージをコピー', 'copy')] : isPair ? [item('compareSelected', '選択した参照を比較', 'compare'), item('compareSelectedSnapshots', '現在のスナップショットを比較', 'compare'), item('showSelectedMergeBase', 'マージベースを表示', 'compare')] : [
    item('compareCurrent', '現在のブランチと比較', 'compare', !isCurrent), item('selectCompareBase', '比較ベースとして選択', 'compare'), item('compareWith', '比較対象を選択…', 'compare'), item('showMergeBase', 'マージベースを表示', 'compare', !isCurrent), item('focus', 'このブランチにフォーカス', 'graph'), item('related', '関連するブランチのみ表示', 'graph'), item('checkout', 'チェックアウト', 'git', !isCurrent), item('createBranch', 'ここからブランチを作成…', 'git'), item('copyName', 'ブランチ名をコピー', 'copy')
  ];
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'contextMenuItems', nodeType: request.nodeType, nodeId: request.nodeId, selectedRefs: request.selectedRefs, x: request.x, y: request.y, items } }));
}, 20);

let handledGroupSummaryRequests = 0;
setInterval(() => {
  const requests = window.__vscodeMessages.filter(message => message?.type === 'showCommitGroupDetails');
  if (requests.length <= handledGroupSummaryRequests) return;
  handledGroupSummaryRequests++;
  window.dispatchEvent(new MessageEvent('message', { data: window.__smokeGroupCommitSummaries }));
}, 20);
