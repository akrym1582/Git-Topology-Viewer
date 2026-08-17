const commits = {
  head: 'f41acde1234567890',
  mainline: 'e93b2101234567890',
  release: 'c81d0451234567890',
  feature: 'a772b901234567890',
  develop: '91bd1201234567890',
  root: '70af9831234567890'
};

function gitRef(name, type, commitId) {
  const prefix = type === 'tag' ? 'refs/tags/' : 'refs/heads/';
  return { name, fullName: `${prefix}${name}`, type, commitId };
}

const refs = [
  gitRef('main', 'localBranch', commits.head),
  gitRef('v1.2.0', 'tag', commits.release),
  gitRef('feature/login', 'localBranch', commits.feature),
  gitRef('develop', 'localBranch', commits.develop),
  { name: 'origin/HEAD', fullName: 'refs/remotes/origin/HEAD', type: 'remoteBranch', commitId: commits.release },
  { name: 'origin/release', fullName: 'refs/remotes/origin/release', type: 'remoteBranch', commitId: commits.release }
];

const positions = [
  [commits.head, 70, 90, [refs[0]]],
  [commits.mainline, 70, 200, []],
  [commits.feature, 220, 310, [refs[2]]],
  [commits.release, 70, 420, [refs[1], refs[4], refs[5]]],
  [commits.develop, 220, 530, [refs[3]]],
  [commits.root, 70, 640, []]
];

const nodes = positions.map(([id, x, y, nodeRefs], row) => ({
  id, kind: 'commit', lane: x === 70 ? 0 : 1, row, x, y,
  commit: { id, parents: [], refs: nodeRefs }
}));

nodes.push(
  {
    id: 'range:main', kind: 'range', lane: 0, row: 2, x: 70, y: 310,
    range: { id: 'range:main', fromCommit: commits.mainline, toCommits: [commits.release], commits: [commits.mainline], count: 12, expanded: false }
  },
  {
    id: 'range:feature', kind: 'range', lane: 1, row: 4, x: 220, y: 420,
    range: { id: 'range:feature', fromCommit: commits.feature, toCommits: [commits.develop], commits: [], count: 8, expanded: false }
  }
);

const edges = [
  [commits.head, commits.mainline],
  [commits.mainline, commits.release],
  [commits.mainline, commits.feature],
  [commits.feature, commits.develop],
  [commits.develop, commits.root],
  [commits.release, commits.root]
].map(([from, to]) => ({ from, to, hiddenCommitCount: 0 }));

function dispatchGraph(expandedRangeIds = []) {
  const expanded = new Set(expandedRangeIds);
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      type: 'graph',
      payload: {
        repository: 'commerce-platform',
        currentBranch: 'main',
        branchStatuses: [
          { ref: 'refs/heads/main', local: true, remote: false },
          { ref: 'refs/heads/feature/login', local: true, remote: false },
          { ref: 'refs/heads/develop', local: true, remote: false },
        ],
        mode: 'topology',
        expandedRangeIds,
        refs,
        graph: {
          nodes: nodes.map(node => node.kind === 'range'
            ? { ...node, range: { ...node.range, expanded: expanded.has(node.id) } }
            : node),
          edges
        }
      }
    }
  }));
}

setTimeout(() => dispatchGraph(), 50);

const expandedRanges = new Set();
let handledRangeRequests = 0;
setInterval(() => {
  const requests = window.__vscodeMessages.filter(message => message.type === 'expandRange');
  if (requests.length <= handledRangeRequests) return;
  const request = requests[handledRangeRequests++];
  if (expandedRanges.has(request.rangeId)) expandedRanges.delete(request.rangeId);
  else expandedRanges.add(request.rangeId);
  dispatchGraph([...expandedRanges]);
}, 20);

window.__smokeComparison = {
  type: 'comparison',
  payload: {
    left: 'refs/heads/main',
    right: 'refs/heads/develop',
    mode: 'divergence',
    mergeBases: [commits.root],
    ahead: 12,
    behind: 3,
    additions: 532,
    deletions: 128,
    files: [
      { status: 'M', path: 'src/AuthService.ts' },
      { status: 'A', path: 'src/LoginService.ts' },
      { status: 'D', path: 'src/OldLoginService.ts' }
    ],
    onlyLeft: [],
    onlyRight: []
  }
};

window.__smokeRefLog = {
  type: 'refLog',
  payload: {
    ref: 'refs/heads/main',
    commits: [
      { id: commits.head, subject: 'Polish authentication flow' },
      { id: commits.mainline, subject: 'Merge feature/login' }
    ]
  }
};

window.__smokeCommitDetails = {
  type: 'commitDetails',
  payload: {
    commit: { id: commits.head, subject: 'Polish authentication flow' },
    parent: commits.mainline,
    additions: 14,
    deletions: 3,
    files: [
      { status: 'M', path: 'src/AuthService.ts', additions: 10, deletions: 2 },
      { status: 'A', path: 'src/LoginService.ts', additions: 4, deletions: 1 }
    ]
  }
};
let handledMenuRequests = 0;
setInterval(() => {
  const requests = window.__vscodeMessages.filter(message => message.type === 'contextMenu');
  if (requests.length <= handledMenuRequests) return;
  const request = requests[handledMenuRequests++];
  const isCurrent = request.nodeId === 'refs/heads/main';
  const isPair = request.selectedRefs?.length === 2;
  const item = (command, label, group, enabled = true) => ({ command, label, group, enabled, visible: true });
  const items = isPair ? [
    item('compareSelected', '選択した参照を比較', 'compare'),
    item('compareSelectedSnapshots', '現在のスナップショットを比較', 'compare'),
    item('showSelectedMergeBase', 'マージベースを表示', 'compare')
  ] : [
    item('compareCurrent', '現在のブランチと比較', 'compare', !isCurrent),
    item('selectCompareBase', '比較ベースとして選択', 'compare'),
    item('compareWith', '比較対象を選択…', 'compare'),
    item('showMergeBase', 'マージベースを表示', 'compare', !isCurrent),
    item('focus', 'このブランチにフォーカス', 'graph'),
    item('related', '関連するブランチのみ表示', 'graph'),
    item('expandCommits', 'コミットを展開', 'graph'),
    item('collapseCommits', 'コミットを折りたたむ', 'graph'),
    item('checkout', 'チェックアウト', 'git', !isCurrent),
    item('createBranch', 'ここからブランチを作成…', 'git'),
    item('copyName', 'ブランチ名をコピー', 'copy'), item('copyHash', 'コミットハッシュをコピー', 'copy')
  ];
  window.dispatchEvent(new MessageEvent('message', { data: {
    type: 'contextMenuItems', nodeId: request.nodeId, selectedRefs: request.selectedRefs, x: request.x, y: request.y, items
  }}));
}, 20);
