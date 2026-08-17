import React, { MouseEvent, useEffect, useMemo, useState } from 'react';
import { BranchComparison, CommitDetails, GitRef, GraphPayload, RefLog, ViewMode } from '../domain/models';
import { GraphContextMenuItem } from '../vscode/messages';
import { WebviewStrings, webviewStrings } from './i18n';
import { vscode } from './vscode';

interface ContextMenuState { ref: GitRef; selectedRefs: string[]; x: number; y: number; items: GraphContextMenuItem[] }

export function App() {
  const ui = webviewStrings(document.documentElement.lang);
  const dataRef = React.useRef<GraphPayload>();
  const [data, setData] = useState<GraphPayload>();
  const [comparison, setComparison] = useState<BranchComparison>();
  const [refLog, setRefLog] = useState<RefLog>();
  const [commitDetails, setCommitDetails] = useState<CommitDetails>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tags, setTags] = useState(true);
  const [remotes, setRemotes] = useState(false);
  const [commitIds, setCommitIds] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<GitRef[]>([]);
  const [menu, setMenu] = useState<ContextMenuState>();
  const [inspectorVisible, setInspectorVisible] = useState(true);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'graph') { setData(event.data.payload); dataRef.current = event.data.payload; }
      if (event.data.type === 'comparison') setComparison(event.data.payload);
      if (event.data.type === 'refLog') { setRefLog(event.data.payload); setCommitDetails(undefined); }
      if (event.data.type === 'commitDetails') setCommitDetails(event.data.payload);
      if (event.data.type === 'error') setError(event.data.message);
      if (event.data.type === 'operationResult') setNotice(event.data.message);
      if (event.data.type === 'contextMenuItems') {
        const ref = dataRef.current?.refs.find(item => item.fullName === event.data.nodeId);
        if (ref) setMenu({ ref, selectedRefs: event.data.selectedRefs ?? [ref.fullName], x: event.data.x, y: event.data.y, items: event.data.items });
      }
      if (event.data.type === 'focusRef' && event.data.commitId) document.querySelector(`[data-commit="${event.data.commitId}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    };
    addEventListener('message', receive);
    return () => removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    addEventListener('click', close);
    return () => removeEventListener('click', close);
  }, [menu]);

  const allowed = useMemo(() => new Set((data?.refs ?? []).filter(ref =>
    (tags || ref.type !== 'tag') && (remotes || ref.type !== 'remoteBranch')
    && (!filter || ref.name.toLowerCase().includes(filter.toLowerCase()))
  ).map(ref => ref.fullName)), [data, tags, remotes, filter]);

  if (!data) return <main className="loading"><div className="spinner"/><h2>{ui.readingTopology}</h2>{error && <p className="error">{error}</p>}</main>;
  const refs = data.refs.filter(ref => allowed.has(ref.fullName));
  const selectRef = (ref: GitRef, additive: boolean) => {
    setRefLog(undefined); setCommitDetails(undefined); setComparison(undefined);
    if (!additive) { setSelected([ref]); vscode.postMessage({ type: 'showRefLog', ref: ref.fullName }); return; }
    const without = selected.filter(item => item.fullName !== ref.fullName);
    if (without.length !== selected.length) { setSelected(without); return; }
    const next = [...without.slice(-1), ref];
    setSelected(next);
    if (next.length === 2) vscode.postMessage({ type: 'compareRefs', left: next[0].fullName, right: next[1].fullName, mode: 'divergence' });
  };
  const openContextMenu = (ref: GitRef, event: MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const selection = selected.some(item => item.fullName === ref.fullName) ? selected : [ref];
    if (selection !== selected) setSelected(selection);
    vscode.postMessage({ type: 'contextMenu', nodeType: ref.type === 'localBranch' ? 'branch' : ref.type, nodeId: ref.fullName, selectedRefs: selection.map(item => item.fullName), x: Math.min(event.clientX, window.innerWidth - 260), y: Math.min(event.clientY, window.innerHeight - 360) });
  };

  return <div className="app" onContextMenu={event => event.preventDefault()}>
    <header><div className="brand"><span className="mark">⌁</span><div><strong>Git Topology</strong><small>{data.repository}</small></div></div><div className="modes">{(['topology', 'compact', 'full'] as ViewMode[]).map(mode => <button key={mode} className={data.mode === mode ? 'active' : ''} onClick={() => vscode.postMessage({ type: 'setViewMode', mode })}>{ui[mode]}</button>)}</div><button className="refresh" onClick={() => vscode.postMessage({ type: 'refresh' })}>↻ {ui.refresh}</button></header>
    <div className="filters"><label><input type="checkbox" checked={tags} onChange={event => setTags(event.target.checked)}/> {ui.tags}</label><label><input type="checkbox" checked={remotes} onChange={event => setRemotes(event.target.checked)}/> {ui.remoteBranches}</label><label title={ui.commitIdsTitle}><input type="checkbox" checked={commitIds} onChange={event => setCommitIds(event.target.checked)}/> {ui.commitIds}</label><input className="search" placeholder={ui.filterBranches} value={filter} onChange={event => setFilter(event.target.value)}/><button className="toggle-inspector" aria-pressed={inspectorVisible} onClick={() => setInspectorVisible(value => !value)}>{inspectorVisible ? ui.hideDetails : ui.showDetails}</button><span>{ui.nodesAndRefs(data.graph.nodes.filter(node => node.kind === 'commit').length, refs.length)}</span></div>
    <div className={`content ${inspectorVisible ? '' : 'inspector-hidden'}`}><Graph data={data} ui={ui} allowed={allowed} showCommitIds={commitIds} selected={new Set(selected.map(ref => ref.fullName))} onSelect={selectRef} onContextMenu={openContextMenu}/>{inspectorVisible && <aside><Inspector ui={ui} selected={selected} refs={refs} comparison={comparison} refLog={refLog} commitDetails={commitDetails} onClose={() => setSelected([])}/></aside>}</div>
    {menu && <ContextMenu ui={ui} menu={menu} onRun={command => { vscode.postMessage({ type: 'runContextCommand', command, nodeId: menu.ref.fullName, selectedRefs: menu.selectedRefs }); setMenu(undefined); }}/>}
    {error && <div className="toast">{error}</div>}
    {notice && <div className="toast success" role="status" onClick={() => setNotice('')}>{notice}</div>}
  </div>;
}

function Graph({ data, ui, allowed, showCommitIds, selected, onSelect, onContextMenu }: { data: GraphPayload; ui: WebviewStrings; allowed: Set<string>; showCommitIds: boolean; selected: Set<string>; onSelect: (ref: GitRef, additive: boolean) => void; onContextMenu: (ref: GitRef, event: MouseEvent) => void }) {
  const [zoom, setZoom] = useState(1);
  const refHeight = showCommitIds ? REF_HEIGHT_WITH_ID : REF_HEIGHT;
  const refTextY = showCommitIds ? 17 : 19;
  const refAnchorY = refTextY - 5;
  const expandedCommitIds = new Set(data.graph.nodes.flatMap(node => node.kind === 'range' && node.range?.expanded ? node.range.commits : []));
  const commits = new Map(data.graph.nodes.filter(node => node.commit).map(node => [node.id, node]));
  const refLayouts = new Map(data.graph.nodes.filter(node => node.kind === 'commit').map(node => [node.id, layoutRefs(node.commit!.refs.filter(ref => allowed.has(ref.fullName)), refHeight, refAnchorY)]));
  const refRects = data.graph.nodes.flatMap(node => node.kind === 'commit' ? refLayouts.get(node.id)!.refs.map(({ position }) => ({ x: node.x + position.x, y: node.y + position.y, width: REF_WIDTH, height: refHeight })) : []).sort((left, right) => left.x - right.x);
  const rangePositions = new Map(data.graph.nodes.filter(node => node.kind === 'range').map(node => {
    let x = node.x + (node.range!.expanded ? 90 : 0);
    for (const rect of refRects) if (node.y - 17 < rect.y + rect.height + 8 && node.y + 17 > rect.y - 8 && x - 8 < rect.x + rect.width + 12 && x + 110 > rect.x - 12) x = rect.x + rect.width + 20;
    return [node.id, { x, y: node.y }] as const;
  }));
  const displayedX = (node: GraphPayload['graph']['nodes'][number]) => rangePositions.get(node.id)?.x ?? node.x;
  const maxX = Math.max(800, ...data.graph.nodes.map(node => displayedX(node) + 300));
  const maxY = Math.max(600, ...data.graph.nodes.map(node => node.y + 100));
  const updateZoom = (next: number) => setZoom(Math.min(2, Math.max(0.5, Math.round(next * 10) / 10)));
  return <section className="canvas" onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)); } }}>
    <div className="zoom-controls" aria-label={ui.zoomControls}><button aria-label={ui.zoomOut} title={ui.zoomOut} disabled={zoom <= 0.5} onClick={() => updateZoom(zoom - 0.1)}>−</button><button aria-label={ui.resetZoom} title={ui.resetZoom} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label={ui.zoomIn} title={ui.zoomIn} disabled={zoom >= 2} onClick={() => updateZoom(zoom + 0.1)}>＋</button></div>
    <svg width={maxX * zoom} height={maxY * zoom}><g transform={`scale(${zoom})`}>
      <g className="edges">{data.graph.edges.map((edge, index) => { const from = commits.get(edge.from); const to = commits.get(edge.to); if (!from || !to) return null; const fromAnchor = refLayouts.get(from.id)!.anchor; const toAnchor = refLayouts.get(to.id)!.anchor; const fromX = from.x + fromAnchor.x; const fromY = from.y + fromAnchor.y; const toX = to.x + toAnchor.x; const toY = to.y + toAnchor.y; return <path key={`${edge.from}:${edge.to}:${index}`} d={`M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`}/>; })}</g>
      {data.graph.nodes.map(node => {
        if (node.kind === 'range') { const expanded = node.range!.expanded; const toggle = () => vscode.postMessage({ type: 'expandRange', rangeId: node.id }); const position = rangePositions.get(node.id)!; const label = expanded ? ui.collapseCommits(node.range!.count) : ui.expandCommits(node.range!.count); return <g key={node.id} className={`range ${expanded ? 'expanded' : ''}`} transform={`translate(${position.x},${position.y})`} onClick={toggle} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }} role="button" tabIndex={0} aria-label={label}><title>{label}</title><rect x="-8" y="-17" width="118" height="34" rx="17"/><text x="10" y="5">{expanded ? '−' : '+'}{ui.commits(node.range!.count)}</text></g>; }
        const layout = refLayouts.get(node.id)!;
        const showStandaloneId = showCommitIds && layout.refs.length === 0 && (expandedCommitIds.has(node.id) || data.mode === 'full');
        return <g key={node.id} data-commit={node.id} className={`node ${(data.mergeBaseIds ?? []).includes(node.id) ? 'merge-base' : ''}`} transform={`translate(${node.x},${node.y})`}>{layout.refs.length > 1 && <g className="ref-connectors" aria-hidden="true">{layout.refs.slice(1).map(({ ref, position }) => <path key={ref.fullName} data-ref-connector={ref.fullName} d={`M ${layout.anchor.x} ${layout.anchor.y} V ${position.y - REF_ROW_GAP / 2} H ${position.x + REF_ICON_CENTER_X} V ${position.y + refAnchorY}`}/>)}</g>}{layout.refs.length === 0 && <circle r="6"/>}{showStandaloneId && <text className="sha" x="18" y="5">{node.id.slice(0, 7)}</text>}{layout.refs.map(({ ref, position }) => <g key={ref.fullName} className={`ref ${ref.type} ${selected.has(ref.fullName) ? 'selected' : ''}`} transform={`translate(${position.x},${position.y})`} onClick={event => { event.stopPropagation(); onSelect(ref, event.ctrlKey || event.metaKey); }} onContextMenu={event => onContextMenu(ref, event)} role="button" aria-label={ui.branchAriaLabel(ref.name)}><rect width={REF_WIDTH} height={refHeight} rx="0"/><text className="ref-icon" x="14" y={refTextY} textAnchor="middle">{refIcon(ref)}</text><text className="ref-name" x="24" y={refTextY}>{displayRefName(ref.name)}{branchState(data, ref)}</text>{showCommitIds && <text className="ref-sha" x="24" y="33">{ref.commitId.slice(0, 7)}</text>}</g>)}</g>;
      })}
    </g></svg><div className="selection-hint">{ui.selectionHint}</div></section>;
}

const REF_WIDTH = 150; const REF_HEIGHT = 28; const REF_HEIGHT_WITH_ID = 42; const REF_ROW_GAP = 6; const REF_ICON_CENTER_X = 14;
const REF_TYPES: GitRef['type'][] = ['tag', 'localBranch', 'remoteBranch'];
interface RefLayout { refs: Array<{ ref: GitRef; position: { x: number; y: number } }>; anchor: { x: number; y: number } }
function layoutRefs(refs: GitRef[], height: number, anchorY: number): RefLayout { const rows = REF_TYPES.flatMap(type => refs.filter(ref => ref.type === type)); const firstRowY = -((rows.length * height) + ((rows.length - 1) * REF_ROW_GAP)) / 2; const positionedRefs = rows.map((ref, rowIndex) => ({ ref, position: { x: -REF_ICON_CENTER_X, y: firstRowY + rowIndex * (height + REF_ROW_GAP) } })); const anchor = positionedRefs[0] ? { x: positionedRefs[0].position.x + REF_ICON_CENTER_X, y: positionedRefs[0].position.y + anchorY } : { x: 0, y: 0 }; return { refs: positionedRefs, anchor }; }

function Inspector({ ui, selected, refs, comparison, refLog, commitDetails, onClose }: { ui: WebviewStrings; selected: GitRef[]; refs: GitRef[]; comparison?: BranchComparison; refLog?: RefLog; commitDetails?: CommitDetails; onClose: () => void }) {
  const primary = selected[0]; const [other, setOther] = useState(''); const [mode, setMode] = useState<'divergence' | 'snapshot'>('divergence');
  useEffect(() => setOther(selected[1]?.fullName ?? refs.find(ref => ref.fullName !== primary?.fullName)?.fullName ?? ''), [primary, selected[1], refs]);
  if (!primary) return <div className="empty"><span>⑂</span><h3>{ui.selectBranchOrTag}</h3><p>{ui.selectBranchOrTagHint}</p></div>;
  const compare = () => vscode.postMessage({ type: 'compareRefs', left: primary.fullName, right: other, mode });
  return <div className="inspector"><button className="close" aria-label={ui.closeInspector} title={ui.closeInspector} onClick={onClose}>×</button><small>{selected.length === 2 ? ui.comparingRefs : primary.type.replace(/([A-Z])/g, ' $1').toUpperCase()}</small><h2>{selected.length === 2 ? `${primary.name} ↔ ${selected[1].name}` : primary.name}</h2><code>{primary.commitId.slice(0, 12)}</code><div className="actions"><button onClick={() => vscode.postMessage({ type: 'copy', value: primary.name })}>{ui.copyName}</button><button onClick={() => vscode.postMessage({ type: 'copy', value: primary.commitId })}>{ui.copySha}</button></div>{refLog?.ref === primary.fullName ? <RefLogView ui={ui} value={refLog} details={commitDetails} onSelectCommit={commit => vscode.postMessage({ type: 'showCommitDetails', commit })}/> : <><hr/><h3>{ui.compareWith}</h3><select value={other} onChange={event => setOther(event.target.value)}>{refs.filter(ref => ref.fullName !== primary.fullName).map(ref => <option key={ref.fullName} value={ref.fullName}>{ref.name}</option>)}</select><label className="radio"><input type="radio" checked={mode === 'divergence'} onChange={() => setMode('divergence')}/> {ui.changesSinceDivergence}</label><label className="radio"><input type="radio" checked={mode === 'snapshot'} onChange={() => setMode('snapshot')}/> {ui.currentSnapshots}</label><button className="primary" disabled={!other} onClick={compare}>{ui.compareRefs}</button>{comparison && comparison.left === primary.fullName && <Comparison ui={ui} value={comparison}/>}</>}</div>;
}
function RefLogView({ ui, value, details, onSelectCommit }: { ui: WebviewStrings; value: RefLog; details?: CommitDetails; onSelectCommit: (commit: string) => void }) { return <div className="ref-log"><hr/><h3>{ui.commitHistory}</h3>{value.commits.length === 0 ? <p>{ui.noCommitsFound}</p> : value.commits.map(commit => <React.Fragment key={commit.id}><button className={`log-entry ${details?.commit.id === commit.id ? 'selected' : ''}`} aria-label={ui.showChangesFor(commit.id)} onClick={() => onSelectCommit(commit.id)}><code>{commit.id.slice(0, 8)}</code><span>{commit.subject}</span></button>{details?.commit.id === commit.id && <CommitFiles ui={ui} value={details}/>}</React.Fragment>)}</div>; }
function CommitFiles({ ui, value }: { ui: WebviewStrings; value: CommitDetails }) { return <div className="commit-files"><div className="metrics"><div><b>{value.files.length}</b><small>{ui.files}</small></div><div><b className="added">+{value.additions}</b><small>{ui.added}</small></div><div><b className="removed">−{value.deletions}</b><small>{ui.removed}</small></div></div>{value.files.length === 0 ? <p>{ui.noFileChanges}</p> : <div className="files">{value.files.map(file => <button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={() => vscode.postMessage({ type: 'openDiff', left: value.commit.id, right: value.parent ?? value.commit.id, path: file.path, oldPath: file.oldPath, status: file.status[0] })}><i className={file.status}>{file.status}</i><span>{file.path}</span><small><ins>+{file.additions ?? 0}</ins> <del>−{file.deletions ?? 0}</del></small></button>)}</div>}</div>; }
function Comparison({ ui, value }: { ui: WebviewStrings; value: BranchComparison }) { return <div className="results"><h3>{ui.comparison}</h3><div className="base"><small>{ui.mergeBase}</small><code>{value.mergeBases[0]?.slice(0, 9) ?? ui.none}</code></div><div className="metrics"><div><b>+{value.ahead}</b><small>{ui.onlyLeft}</small></div><div><b>{value.behind}</b><small>{ui.onlyRight}</small></div><div><b>{value.files.length}</b><small>{ui.files}</small></div></div><p className="stat"><ins>+{value.additions}</ins> <del>−{value.deletions}</del></p><h3>{ui.changedFiles}</h3><div className="files">{value.files.map(file => <button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={() => vscode.postMessage({ type: 'openDiff', left: value.left, right: value.right, path: file.path, oldPath: file.oldPath, status: file.status[0] })}><i className={file.status}>{file.status}</i><span>{file.path}</span></button>)}</div></div>; }
function branchState(data: GraphPayload, ref: GitRef): string { if (ref.type === 'remoteBranch') return ' [R]'; if (ref.type !== 'localBranch') return ''; const status = (data.branchStatuses ?? []).find(item => item.ref === ref.fullName); if (!status?.remote) return ' [L]'; const movement = status.ahead || status.behind ? `${status.ahead ? ` ↑${status.ahead}` : ''}${status.behind ? ` ↓${status.behind}` : ''}` : ' ='; return ` [L][R]${movement}`; }
function refIcon(ref: GitRef): string { return ref.type === 'tag' ? '◆' : ref.type === 'remoteBranch' ? '☁' : '⑂'; }
function displayRefName(name: string): string { return name.length > 18 ? `${name.slice(0, 17)}…` : name; }
function ContextMenu({ ui, menu, onRun }: { ui: WebviewStrings; menu: ContextMenuState; onRun: (command: GraphContextMenuItem['command']) => void }) { const groups: GraphContextMenuItem['group'][] = ['compare', 'graph', 'git', 'manage', 'copy']; return <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}><div className="context-title">{menu.selectedRefs.length === 2 ? ui.compareSelectedRefs : menu.ref.name}</div>{groups.map(group => { const items = menu.items.filter(item => item.visible && item.group === group); return items.length ? <React.Fragment key={group}><div className="context-group">{ui.contextGroup(group)}</div>{items.map(item => <button key={item.command} role="menuitem" disabled={!item.enabled} onClick={() => onRun(item.command)}>{item.label}</button>)}</React.Fragment> : null; })}</div>; }
