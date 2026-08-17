const commits = { main: 'f41acde1234567890', release: 'c81d0451234567890', feature: 'a772b901234567890', develop: '91bd1201234567890' };
function gitRef(name, type, commitId) { const prefix = type === 'tag' ? 'refs/tags/' : type === 'remoteBranch' ? 'refs/remotes/' : 'refs/heads/'; return { name, fullName: `${prefix}${name}`, type, commitId }; }

const refs = [
  gitRef('main', 'localBranch', commits.main), gitRef('v1.2.0', 'tag', commits.release), gitRef('feature/login', 'localBranch', commits.feature), gitRef('develop', 'localBranch', commits.develop),
  gitRef('origin/HEAD', 'remoteBranch', commits.release), gitRef('origin/release', 'remoteBranch', commits.release)
];
const graph = {
  nodes: [
    { id: commits.main, lane: 0, row: 0, x: 70, y: 90, refs: [refs[0]] },
    { id: commits.feature, lane: 1, row: 1, x: 260, y: 210, refs: [refs[2]] },
    { id: commits.release, lane: 0, row: 2, x: 70, y: 330, refs: [refs[1], refs[4], refs[5]] },
    { id: commits.develop, lane: 1, row: 3, x: 260, y: 450, refs: [refs[3]] }
  ],
  edges: [
    { from: commits.main, to: commits.feature }, { from: commits.feature, to: commits.develop }, { from: commits.develop, to: commits.release }
  ]
};

function dispatchGraph(tags = true, remotes = false) { const visible = nodeRefs => nodeRefs.filter(item => item.type === 'localBranch' || (item.type === 'tag' && tags) || (item.type === 'remoteBranch' && remotes)); const filteredGraph = { ...graph, nodes: graph.nodes.map(node => ({ ...node, refs: visible(node.refs) })).filter(node => node.refs.length) }; window.dispatchEvent(new MessageEvent('message', { data: { type: 'graph', payload: { repository: 'commerce-platform', currentBranch: 'main', branchStatuses: [{ ref: 'refs/heads/main', local: true, remote: false }, { ref: 'refs/heads/feature/login', local: true, remote: false }, { ref: 'refs/heads/develop', local: true, remote: false }], refs, graph: filteredGraph } } })); }
setTimeout(() => dispatchGraph(), 50);

let handledVisibilityRequests = 0;
setInterval(() => { const requests = window.__vscodeMessages.filter(message => message.type === 'setRefVisibility'); if (requests.length <= handledVisibilityRequests) return; const request = requests[handledVisibilityRequests++]; dispatchGraph(request.tags, request.remotes); }, 20);

window.__smokeComparison = { type: 'comparison', payload: { left: 'refs/heads/main', right: 'refs/heads/develop', mode: 'divergence', mergeBases: [commits.release], ahead: 12, behind: 3, additions: 532, deletions: 128, files: [{ status: 'M', path: 'src/AuthService.ts' }, { status: 'A', path: 'src/LoginService.ts' }, { status: 'D', path: 'src/OldLoginService.ts' }], onlyLeft: [], onlyRight: [] } };
window.__smokeMainLog = { type: 'refLog', payload: { ref: 'refs/heads/main', commits: [{ id: commits.main, subject: 'Polish relationship view' }, { id: 'e93b2101234567890', subject: 'Merge feature/login' }] } };
window.__smokeFeatureLog = { type: 'refLog', payload: { ref: 'refs/heads/feature/login', branchPoint: { id: commits.release, subject: 'Release baseline' }, commits: [{ id: commits.feature, subject: 'Improve login flow' }] } };
window.__smokeCommitDetails = { type: 'commitDetails', payload: { commit: { id: commits.main, subject: 'Polish relationship view' }, parent: 'e93b2101234567890', additions: 14, deletions: 2, files: [{ status: 'M', path: 'src/AuthService.ts', additions: 10, deletions: 2 }, { status: 'A', path: 'src/LoginService.ts', additions: 4, deletions: 0 }] } };

let handledMenuRequests = 0;
setInterval(() => {
  const requests = window.__vscodeMessages.filter(message => message.type === 'contextMenu');
  if (requests.length <= handledMenuRequests) return;
  const request = requests[handledMenuRequests++];
  const isCurrent = request.nodeId === 'refs/heads/main';
  const isPair = request.selectedRefs?.length === 2;
  const item = (command, label, group, enabled = true) => ({ command, label, group, enabled, visible: true });
  const items = isPair ? [item('compareSelected', '選択した参照を比較', 'compare'), item('compareSelectedSnapshots', '現在のスナップショットを比較', 'compare'), item('showSelectedMergeBase', 'マージベースを表示', 'compare')] : [
    item('compareCurrent', '現在のブランチと比較', 'compare', !isCurrent), item('selectCompareBase', '比較ベースとして選択', 'compare'), item('compareWith', '比較対象を選択…', 'compare'), item('showMergeBase', 'マージベースを表示', 'compare', !isCurrent), item('focus', 'このブランチにフォーカス', 'graph'), item('related', '関連するブランチのみ表示', 'graph'), item('checkout', 'チェックアウト', 'git', !isCurrent), item('createBranch', 'ここからブランチを作成…', 'git'), item('copyName', 'ブランチ名をコピー', 'copy')
  ];
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'contextMenuItems', nodeId: request.nodeId, selectedRefs: request.selectedRefs, x: request.x, y: request.y, items } }));
}, 20);
