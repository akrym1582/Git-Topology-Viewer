import React, { MouseEvent, useEffect, useMemo, useState } from 'react';
import { BranchComparison, CommitDetails, CommitInfo, CommitViewGraph, GitRef, GraphPayload, RefLog, RefViewGraph } from '../domain/models';
import { GraphContextMenuItem } from '../vscode/messages';
import { WebviewStrings, webviewStrings } from './i18n';
import { relationEdgePath } from './relationEdgeRouting';
import { vscode } from './vscode';

interface ContextMenuState { nodeType: 'branch' | 'remoteBranch' | 'tag' | 'commit'; nodeId: string; ref?: GitRef; selectedRefs: string[]; x: number; y: number; items: GraphContextMenuItem[] }
type ViewMode = 'relations' | 'significant' | 'commits';

export function App() {
  const ui = webviewStrings(document.documentElement.lang);
  const dataRef = React.useRef<GraphPayload>();
  const [data, setData] = useState<GraphPayload>();
  const [comparison, setComparison] = useState<BranchComparison>();
  const [refLog, setRefLog] = useState<RefLog>();
  const [commitDetails, setCommitDetails] = useState<Record<string, CommitDetails>>({});
  const [expandedCommitDetails, setExpandedCommitDetails] = useState<Set<string>>(new Set());
  const [commitGroupSummaries, setCommitGroupSummaries] = useState<CommitInfo[]>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tags, setTags] = useState(true);
  const [remotes, setRemotes] = useState(false);
  const [showBranchCommits, setShowBranchCommits] = useState(true);
  const [summarizeCommits, setSummarizeCommits] = useState(true);
  const [showAllCommits, setShowAllCommits] = useState(false);
  const [selected, setSelected] = useState<GitRef[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string>();
  const [selectedCommitGroup, setSelectedCommitGroup] = useState<string[]>();
  const [menu, setMenu] = useState<ContextMenuState>();
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [inspectorWidth, setInspectorWidth] = useState(340);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !('type' in message)) return;
      if (message.type === 'graph') { setData(message.payload); dataRef.current = message.payload; setError(''); }
      if (message.type === 'comparison') setComparison(message.payload);
      if (message.type === 'refLog') { setRefLog(message.payload); setCommitDetails({}); setExpandedCommitDetails(new Set()); }
      if (message.type === 'commitDetails') {
        const details = message.payload as CommitDetails;
        setCommitDetails(current => ({ ...current, [details.commit.id]: details }));
        setExpandedCommitDetails(current => new Set(current).add(details.commit.id));
      }
      if (message.type === 'commitGroupDetails') { setCommitGroupSummaries(message.payload.commits); setCommitDetails({}); setExpandedCommitDetails(new Set()); }
      if (message.type === 'error') setError(message.message);
      if (message.type === 'operationResult') setNotice(message.message);
      if (message.type === 'contextMenuItems') {
        const ref = dataRef.current?.refs.find(item => item.fullName === message.nodeId);
        if (message.nodeType === 'commit' || ref) setMenu({ nodeType: message.nodeType, nodeId: message.nodeId, ref, selectedRefs: message.selectedRefs ?? (ref ? [ref.fullName] : []), x: message.x, y: message.y, items: message.items });
      }
      if (message.type === 'focusRef' && message.commitId) document.querySelector(`[data-ref-node="${message.commitId}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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

  const visibleGraph = !showBranchCommits
    ? data?.graph
    : showAllCommits ? data?.commitGraph : summarizeCommits ? data?.significantGraph : data?.minimalGraph;
  const renderGraph = visibleGraph ?? data?.significantGraph;
  const renderMode: ViewMode = showBranchCommits ? 'significant' : 'relations';
  const visibleRefs = useMemo(() => renderGraph?.nodes.flatMap(node => node.refs) ?? [], [renderGraph]);
  const visibleCommitCount = useMemo(() => renderGraph?.nodes.reduce((count, node) => count + ((node as CommitViewGraph['nodes'][number]).commitIds?.length ?? 1), 0) ?? 0, [renderGraph]);
  if (!data) return <main className="loading"><div className="spinner"/><h2>{ui.readingRelations}</h2>{error && <p className="error">{error}</p>}</main>;
  if (!renderGraph) return <main className="loading"><h2>{ui.graphUnavailable}</h2>{error && <p className="error">{error}</p>}</main>;
  const clampInspectorWidth = (width: number) => Math.min(getMaxInspectorWidth(), Math.max(MIN_INSPECTOR_WIDTH, width));
  const startInspectorResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const update = (moveEvent: PointerEvent) => setInspectorWidth(clampInspectorWidth(startWidth + startX - moveEvent.clientX));
    const stop = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointermove', update); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  };
  const adjustInspectorWidth = (delta: number) => setInspectorWidth(width => clampInspectorWidth(width + delta));
  const selectRef = (ref: GitRef, additive: boolean) => {
    setComparison(undefined); setRefLog(undefined); setCommitDetails({}); setExpandedCommitDetails(new Set()); setSelectedCommit(undefined); setSelectedCommitGroup(undefined);
    if (!additive) { setSelected([ref]); vscode.postMessage({ type: 'showRefLog', ref: ref.fullName }); return; }
    const without = selected.filter(item => item.fullName !== ref.fullName);
    if (without.length !== selected.length) { setSelected(without); return; }
    const next = [...without.slice(-1), ref];
    setSelected(next);
    if (next.length === 2) vscode.postMessage({ type: 'compareRefs', left: next[0].fullName, right: next[1].fullName, mode: 'divergence' });
  };
  const closeCommitDetails = (commit: string) => {
    setExpandedCommitDetails(current => { const next = new Set(current); next.delete(commit); return next; });
  };
  const selectCommit = (commit: string, keepRefLog = false, keepCommitGroup = false, toggleSelected = true, reload = false) => {
    if (toggleSelected && selectedCommit === commit) {
      if (expandedCommitDetails.has(commit)) closeCommitDetails(commit);
      return;
    }
    setComparison(undefined); setSelectedCommit(commit); if (!keepCommitGroup) setSelectedCommitGroup(undefined);
    if (!keepRefLog) { setSelected([]); setRefLog(undefined); }
    if (!keepRefLog && !keepCommitGroup) { setCommitDetails({}); setExpandedCommitDetails(new Set()); }
    if (commitDetails[commit] && !reload) {
      setExpandedCommitDetails(current => new Set(current).add(commit));
      return;
    }
    vscode.postMessage({ type: 'showCommitDetails', commit });
  };
  const selectCommitGroup = (commitIds: string[]) => {
    setComparison(undefined); setRefLog(undefined); setCommitDetails({}); setExpandedCommitDetails(new Set()); setCommitGroupSummaries(undefined); setSelected([]); setSelectedCommit(undefined); setSelectedCommitGroup(commitIds);
    vscode.postMessage({ type: 'showCommitGroupDetails', commits: commitIds });
  };
  const openContextMenu = (ref: GitRef, event: MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const selection = selected.some(item => item.fullName === ref.fullName) ? selected : [ref];
    if (selection !== selected) setSelected(selection);
    vscode.postMessage({ type: 'contextMenu', nodeType: ref.type === 'localBranch' ? 'branch' : ref.type, nodeId: ref.fullName, selectedRefs: selection.map(item => item.fullName), x: Math.min(event.clientX, window.innerWidth - 260), y: Math.min(event.clientY, window.innerHeight - 360) });
  };
  const openCommitContextMenu = (commit: string, event: MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    vscode.postMessage({ type: 'contextMenu', nodeType: 'commit', nodeId: commit, selectedRefs: [], x: Math.min(event.clientX, window.innerWidth - 260), y: Math.min(event.clientY, window.innerHeight - 360) });
  };
  const setRefVisibility = (nextTags: boolean, nextRemotes: boolean) => {
    setTags(nextTags); setRemotes(nextRemotes);
    vscode.postMessage({ type: 'setRefVisibility', tags: nextTags, remotes: nextRemotes });
  };
  return <div className="app" onContextMenu={event => event.preventDefault()}>
    <header><div className="brand"><span className="mark">⌁</span><div><strong>{ui.significantGraph}</strong><small>{data.repository}</small></div></div><button className="refresh" onClick={() => vscode.postMessage({ type: 'refresh' })}>↻ {ui.refresh}</button></header>
    <div className="filters"><label><input type="checkbox" checked={tags} onChange={event => setRefVisibility(event.target.checked, remotes)}/> {ui.tags}</label><label><input type="checkbox" checked={remotes} onChange={event => setRefVisibility(tags, event.target.checked)}/> {ui.remoteBranches}</label><label><input type="checkbox" checked={showBranchCommits} onChange={event => setShowBranchCommits(event.target.checked)}/> {ui.showBranchCommits}</label><label><input type="checkbox" checked={summarizeCommits} onChange={event => setSummarizeCommits(event.target.checked)} disabled={!showBranchCommits}/> {ui.summarizeCommits}</label><label><input type="checkbox" checked={showAllCommits} onChange={event => setShowAllCommits(event.target.checked)} disabled={!showBranchCommits}/> {ui.showAllCommits}</label><button className="toggle-inspector" aria-pressed={inspectorVisible} onClick={() => setInspectorVisible(value => !value)}>{inspectorVisible ? ui.hideDetails : ui.showDetails}</button><span>{showBranchCommits ? ui.commitsAndRefs(visibleCommitCount, visibleRefs.length) : ui.nodesAndRefs(renderGraph.nodes.length, visibleRefs.length)}</span></div>
    <div className={`content ${inspectorVisible ? '' : 'inspector-hidden'}`} style={inspectorVisible ? { gridTemplateColumns: `minmax(0, 1fr) 9px ${inspectorWidth}px` } : undefined}><Graph graph={renderGraph} mode={renderMode} data={data} ui={ui} selected={new Set(selected.map(ref => ref.fullName))} selectedCommit={selectedCommit} onSelect={selectRef} onSelectCommit={selectCommit} onSelectCommitGroup={selectCommitGroup} onContextMenu={openContextMenu} onContextMenuCommit={openCommitContextMenu}/>{inspectorVisible && <><div className="inspector-resizer" role="separator" aria-orientation="vertical" aria-label={ui.resizeDetails} aria-valuemin={MIN_INSPECTOR_WIDTH} aria-valuemax={getMaxInspectorWidth()} aria-valuenow={inspectorWidth} tabIndex={0} title={ui.resizeDetails} onPointerDown={startInspectorResize} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); adjustInspectorWidth(16); } if (event.key === 'ArrowRight') { event.preventDefault(); adjustInspectorWidth(-16); } if (event.key === 'Home') { event.preventDefault(); setInspectorWidth(MIN_INSPECTOR_WIDTH); } if (event.key === 'End') { event.preventDefault(); setInspectorWidth(getMaxInspectorWidth()); } }}/><aside><Inspector ui={ui} selected={selected} refs={visibleRefs} comparison={comparison} refLog={refLog} commitDetails={commitDetails} expandedCommitDetails={expandedCommitDetails} commitGroupSummaries={commitGroupSummaries} selectedCommit={selectedCommit} selectedCommitGroup={selectedCommitGroup} onSelectCommit={commit => selectCommit(commit, Boolean(refLog), Boolean(selectedCommitGroup))} onCloseCommitDetails={closeCommitDetails} onContextMenuCommit={openCommitContextMenu} onClose={() => { setSelected([]); setSelectedCommit(undefined); setSelectedCommitGroup(undefined); }}/></aside></>}</div>
    {menu && <ContextMenu ui={ui} menu={menu} onRun={command => {
      if (command === 'showChanges' && menu.nodeType === 'commit') selectCommit(menu.nodeId, Boolean(refLog), Boolean(selectedCommitGroup), false, true);
      else vscode.postMessage({ type: 'runContextCommand', command, nodeType: menu.nodeType, nodeId: menu.nodeId, selectedRefs: menu.selectedRefs });
      setMenu(undefined);
    }}/>}
    {error && <div className="toast">{error}</div>}
    {notice && <div className="toast success" role="status" onClick={() => setNotice('')}>{notice}</div>}
  </div>;
}

const MIN_INSPECTOR_WIDTH = 260;
const MAX_INSPECTOR_WIDTH = 620;
const MIN_GRAPH_WIDTH = 360;
function getMaxInspectorWidth(): number { return Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, window.innerWidth - MIN_GRAPH_WIDTH)); }

function Graph({ graph, mode, data, ui, selected, selectedCommit, onSelect, onSelectCommit, onSelectCommitGroup, onContextMenu, onContextMenuCommit }: { graph: RefViewGraph | CommitViewGraph; mode: ViewMode; data: GraphPayload; ui: WebviewStrings; selected: Set<string>; selectedCommit?: string; onSelect: (ref: GitRef, additive: boolean) => void; onSelectCommit: (commit: string) => void; onSelectCommitGroup: (commitIds: string[]) => void; onContextMenu: (ref: GitRef, event: MouseEvent) => void; onContextMenuCommit: (commit: string, event: MouseEvent) => void }) {
  const [zoom, setZoom] = useState(1);
  const refLayouts = new Map(graph.nodes.map(node => [node.id, layoutRefs(node.refs)]));
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const maxX = Math.max(800, ...graph.nodes.map(node => node.x + 300));
  const maxY = Math.max(600, ...graph.nodes.map(node => node.y + 100));
  const updateZoom = (next: number) => setZoom(Math.min(2, Math.max(0.5, Math.round(next * 10) / 10)));
  return <section className="canvas" onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)); } }}>
    <div className="zoom-controls" aria-label={ui.zoomControls}><button aria-label={ui.zoomOut} title={ui.zoomOut} disabled={zoom <= 0.5} onClick={() => updateZoom(zoom - 0.1)}>−</button><button aria-label={ui.resetZoom} title={ui.resetZoom} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label={ui.zoomIn} title={ui.zoomIn} disabled={zoom >= 2} onClick={() => updateZoom(zoom + 0.1)}>＋</button></div>
    <svg width={maxX * zoom} height={maxY * zoom}>
      <g transform={`scale(${zoom})`}>
        <g className={`edges ${mode !== 'relations' ? 'commit-edges' : ''}`}>
          {graph.edges.map(edge => {
            const from = nodes.get(edge.from);
            const to = nodes.get(edge.to);
            if (!from || !to) return null;
            if (mode === 'relations') {
              const fromLayout = refLayouts.get(from.id)!;
              const toLayout = refLayouts.get(to.id)!;
              const fromPoint = { x: from.x + REF_WIDTH / 2 - REF_ICON_CENTER_X, y: from.y + fromLayout.top + REF_HEIGHT };
              const toPoint = { x: to.x + REF_WIDTH / 2 - REF_ICON_CENTER_X, y: to.y + toLayout.top };
              return <path key={`${edge.from}:${edge.to}`} d={relationEdgePath(fromPoint, toPoint)}/>;
            }
            const fromX = from.x; const fromY = from.y; const toX = to.x; const toY = to.y;
            return <path key={`${edge.from}:${edge.to}`} d={`M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`}/>;
          })}
        </g>
        {graph.nodes.map(node => {
          const layout = refLayouts.get(node.id)!;
          if (mode !== 'relations') {
            const commitNode = node as CommitViewGraph['nodes'][number];
            return commitNode.commitIds
              ? <CommitGroupNode key={node.id} node={commitNode} ui={ui} onSelect={onSelectCommitGroup}/>
              : <CommitNode key={node.id} node={commitNode} data={data} ui={ui} selected={selected} selectedCommit={selectedCommit} onSelect={onSelect} onSelectCommit={onSelectCommit} onContextMenu={onContextMenu} onContextMenuCommit={onContextMenuCommit}/>;
          }
          return <g key={node.id} data-ref-node={node.id} className="node" transform={`translate(${node.x},${node.y})`}>
            {layout.refs.length > 1 && <g className="ref-connectors" aria-hidden="true">{layout.refs.slice(1).map(({ ref, position }) => <path key={ref.fullName} data-ref-connector={ref.fullName} d={`M ${layout.anchor.x} ${layout.anchor.y} V ${position.y - REF_ROW_GAP / 2} H ${position.x + REF_ICON_CENTER_X} V ${position.y + REF_ANCHOR_Y}`}/>)}</g>}
            {layout.refs.map(({ ref, position }) => <RefNode key={ref.fullName} gitRef={ref} position={position} data={data} ui={ui} selected={selected} onSelect={onSelect} onContextMenu={onContextMenu}/>)}
          </g>;
        })}
      </g>
    </svg>
    <div className="selection-hint">{ui.selectionHint}</div>
  </section>;
  }

const REF_WIDTH = 150; const REF_HEIGHT = 28; const REF_ROW_GAP = 6; const REF_ICON_CENTER_X = 14; const REF_TEXT_Y = 19; const REF_ANCHOR_Y = REF_TEXT_Y - 5;
const REF_TYPES: GitRef['type'][] = ['tag', 'localBranch', 'remoteBranch'];
interface RefLayout { refs: Array<{ ref: GitRef; position: { x: number; y: number } }>; anchor: { x: number; y: number }; top: number }
function layoutRefs(refs: GitRef[]): RefLayout { const rows = REF_TYPES.flatMap(type => refs.filter(ref => ref.type === type)); const firstRowY = -((rows.length * REF_HEIGHT) + ((rows.length - 1) * REF_ROW_GAP)) / 2; const positionedRefs = rows.map((ref, rowIndex) => ({ ref, position: { x: -REF_ICON_CENTER_X, y: firstRowY + rowIndex * (REF_HEIGHT + REF_ROW_GAP) } })); const anchor = positionedRefs[0] ? { x: positionedRefs[0].position.x + REF_ICON_CENTER_X, y: positionedRefs[0].position.y + REF_ANCHOR_Y } : { x: 0, y: 0 }; return { refs: positionedRefs, anchor, top: firstRowY }; }

function CommitNode({ node, data, ui, selected, selectedCommit, onSelect, onSelectCommit, onContextMenu, onContextMenuCommit }: { node: CommitViewGraph['nodes'][number]; data: GraphPayload; ui: WebviewStrings; selected: Set<string>; selectedCommit?: string; onSelect: (ref: GitRef, additive: boolean) => void; onSelectCommit: (commit: string) => void; onContextMenu: (ref: GitRef, event: MouseEvent) => void; onContextMenuCommit: (commit: string, event: MouseEvent) => void }) {
  const refs = layoutRefs(node.refs).refs;
  const activate = () => onSelectCommit(node.id);
  return <g data-ref-node={node.id} className={`node commit-node ${selectedCommit === node.id ? 'selected' : ''}`} transform={`translate(${node.x},${node.y})`} role="button" tabIndex={0} aria-label={ui.commitAriaLabel(node.id)} onClick={activate} onContextMenu={event => onContextMenuCommit(node.id, event)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}><circle r="7"/><text className="commit-id" x="15" y="4">{node.id.slice(0, 8)}</text>{refs.map(({ ref, position }) => <RefNode key={ref.fullName} gitRef={ref} position={{ x: position.x + 16, y: position.y - 22 }} data={data} ui={ui} selected={selected} onSelect={onSelect} onContextMenu={onContextMenu}/>)}</g>;
}

function CommitGroupNode({ node, ui, onSelect }: { node: CommitViewGraph['nodes'][number]; ui: WebviewStrings; onSelect: (commitIds: string[]) => void }) {
  const commitIds = node.commitIds ?? [];
  const first = commitIds[0]?.slice(0, 8) ?? '';
  const last = commitIds.at(-1)?.slice(0, 8) ?? '';
  const activate = () => onSelect(commitIds);
  return <g className="node commit-group" transform={`translate(${node.x},${node.y})`} role="button" tabIndex={0} aria-label={ui.commitGroupAriaLabel(commitIds.length)} onClick={activate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}><rect className="group-badge" x="-52" y="-15" width="104" height="30" rx="15"/><text className="group-label" x="0" y="4" textAnchor="middle">{ui.commitGroup(commitIds.length)}</text><text className="group-range" x="64" y="4">{first} → {last}</text></g>;
}

function RefNode({ gitRef, position, data, ui, selected, onSelect, onContextMenu }: { gitRef: GitRef; position: { x: number; y: number }; data: GraphPayload; ui: WebviewStrings; selected: Set<string>; onSelect: (ref: GitRef, additive: boolean) => void; onContextMenu: (ref: GitRef, event: MouseEvent) => void }) {
  const current = isCurrentBranch(data, gitRef);
  return <g className={`ref ${gitRef.type} ${current ? 'current' : ''} ${selected.has(gitRef.fullName) ? 'selected' : ''}`} transform={`translate(${position.x},${position.y})`} onClick={event => { event.stopPropagation(); onSelect(gitRef, event.ctrlKey || event.metaKey); }} onContextMenu={event => onContextMenu(gitRef, event)} role="button" aria-label={`${ui.branchAriaLabel(gitRef.name)}${current ? ` (${ui.currentBranchMarker})` : ''}`}><rect width={REF_WIDTH} height={REF_HEIGHT} rx="0"/><text className="ref-icon" x="14" y={REF_TEXT_Y} textAnchor="middle">{refIcon(gitRef)}</text><text className="ref-name" x="24" y={REF_TEXT_Y}>{displayRefName(gitRef.name)}{branchState(data, gitRef, ui)}</text></g>;
}

function Inspector({ ui, selected, refs, comparison, refLog, commitDetails, expandedCommitDetails, commitGroupSummaries, selectedCommit, selectedCommitGroup, onSelectCommit, onCloseCommitDetails, onContextMenuCommit, onClose }: { ui: WebviewStrings; selected: GitRef[]; refs: GitRef[]; comparison?: BranchComparison; refLog?: RefLog; commitDetails: Record<string, CommitDetails>; expandedCommitDetails: Set<string>; commitGroupSummaries?: CommitInfo[]; selectedCommit?: string; selectedCommitGroup?: string[]; onSelectCommit: (commit: string) => void; onCloseCommitDetails: (commit: string) => void; onContextMenuCommit: (commit: string, event: MouseEvent) => void; onClose: () => void }) { const primary = selected[0]; const [other, setOther] = useState(''); const [mode, setMode] = useState<'divergence' | 'snapshot'>('divergence'); useEffect(() => setOther(selected[1]?.fullName ?? refs.find(ref => ref.fullName !== primary?.fullName)?.fullName ?? ''), [primary, selected[1], refs]); if (!primary && selectedCommitGroup) return <CommitGroupInspector ui={ui} commitIds={selectedCommitGroup} summaries={commitGroupSummaries} details={commitDetails} expandedCommitDetails={expandedCommitDetails} selectedCommit={selectedCommit} onSelectCommit={onSelectCommit} onCloseCommitDetails={onCloseCommitDetails} onContextMenuCommit={onContextMenuCommit} onClose={onClose}/>; if (!primary && selectedCommit) return <CommitInspector ui={ui} commit={selectedCommit} details={commitDetails[selectedCommit]} expanded={expandedCommitDetails.has(selectedCommit)} onCloseCommitDetails={onCloseCommitDetails} onClose={onClose}/>; if (!primary) return <div className="empty"><span>⑂</span><h3>{ui.selectBranchOrTag}</h3><p>{ui.selectBranchOrTagHint}</p></div>; const compare = () => vscode.postMessage({ type: 'compareRefs', left: primary.fullName, right: other, mode }); return <div className="inspector"><button className="close" aria-label={ui.closeInspector} title={ui.closeInspector} onClick={onClose}>×</button><small>{selected.length === 2 ? ui.comparingRefs : primary.type.replace(/([A-Z])/g, ' $1').toUpperCase()}</small><h2>{selected.length === 2 ? `${primary.name} ↔ ${selected[1].name}` : primary.name}</h2><div className="actions"><button onClick={() => vscode.postMessage({ type: 'copy', value: primary.name })}>{ui.copyName}</button></div>{selected.length === 1 && refLog?.ref === primary.fullName ? <RefLogView ui={ui} value={refLog} details={commitDetails} expandedCommitDetails={expandedCommitDetails} selectedCommit={selectedCommit} onSelectCommit={onSelectCommit} onCloseCommitDetails={onCloseCommitDetails} onContextMenuCommit={onContextMenuCommit}/> : <><hr/><h3>{ui.compareWith}</h3><select value={other} onChange={event => setOther(event.target.value)}>{refs.filter(ref => ref.fullName !== primary.fullName).map(ref => <option key={ref.fullName} value={ref.fullName}>{ref.name}</option>)}</select><label className="radio"><input type="radio" checked={mode === 'divergence'} onChange={() => setMode('divergence')}/> {ui.changesSinceDivergence}</label><label className="radio"><input type="radio" checked={mode === 'snapshot'} onChange={() => setMode('snapshot')}/> {ui.currentSnapshots}</label><button className="primary" disabled={!other} onClick={compare}>{ui.compareRefs}</button>{comparison && comparison.left === primary.fullName && <Comparison ui={ui} value={comparison}/>}</>}</div>; }
function CommitInspector({ ui, commit, details, expanded, onCloseCommitDetails, onClose }: { ui: WebviewStrings; commit: string; details?: CommitDetails; expanded: boolean; onCloseCommitDetails: (commit: string) => void; onClose: () => void }) { const value = details?.commit.id === commit ? details : undefined; return <div className="inspector"><button className="close" aria-label={ui.closeInspector} title={ui.closeInspector} onClick={onClose}>×</button><small>{ui.commitDetails}</small><h2><code>{commit}</code></h2>{value ? <><p className="commit-subject">{value.commit.subject}</p>{expanded && <CommitFiles ui={ui} value={value} onClose={() => onCloseCommitDetails(commit)}/>}</> : <p className="loading-details">{ui.loadingCommitDetails}</p>}</div>; }
function CommitGroupInspector({ ui, commitIds, summaries, details, expandedCommitDetails, selectedCommit, onSelectCommit, onCloseCommitDetails, onContextMenuCommit, onClose }: { ui: WebviewStrings; commitIds: string[]; summaries?: CommitInfo[]; details: Record<string, CommitDetails>; expandedCommitDetails: Set<string>; selectedCommit?: string; onSelectCommit: (commit: string) => void; onCloseCommitDetails: (commit: string) => void; onContextMenuCommit: (commit: string, event: MouseEvent) => void; onClose: () => void }) { const summaryMap = new Map((summaries ?? []).map(commit => [commit.id, commit])); const commits = commitIds.map(id => summaryMap.get(id) ?? ({ id, subject: '' })); return <div className="inspector"><button className="close" aria-label={ui.closeInspector} title={ui.closeInspector} onClick={onClose}>×</button><small>{ui.commitGroupDetails}</small><h2>{ui.commitGroup(commitIds.length)}</h2><RefLogView ui={ui} value={{ ref: '', commits }} details={details} expandedCommitDetails={expandedCommitDetails} selectedCommit={selectedCommit} onSelectCommit={onSelectCommit} onCloseCommitDetails={onCloseCommitDetails} onContextMenuCommit={onContextMenuCommit} title={ui.commitGroupDetails}/></div>; }
function RefLogView({ ui, value, details, expandedCommitDetails, selectedCommit, onSelectCommit, onCloseCommitDetails, onContextMenuCommit, title = ui.commitHistory }: { ui: WebviewStrings; value: RefLog; details: Record<string, CommitDetails>; expandedCommitDetails: Set<string>; selectedCommit?: string; onSelectCommit: (commit: string) => void; onCloseCommitDetails: (commit: string) => void; onContextMenuCommit: (commit: string, event: MouseEvent) => void; title?: string }) { const entry = (commit: import('../domain/models').CommitInfo, branchPoint = false) => { const detailsForCommit = details[commit.id]; const expanded = expandedCommitDetails.has(commit.id) && Boolean(detailsForCommit); return <React.Fragment key={commit.id}>{branchPoint && <small className="branch-point">{ui.branchPoint}</small>}<button className={`log-entry ${selectedCommit === commit.id ? 'selected' : ''}`} aria-label={ui.showChangesFor(commit.id)} onClick={() => onSelectCommit(commit.id)} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onContextMenuCommit(commit.id, event); }}><code>{commit.id.slice(0, 8)}</code><span><strong>{commit.subject || detailsForCommit?.commit.subject || ''}</strong>{commitMeta(ui, commit)}</span></button>{expanded && <CommitFiles ui={ui} value={detailsForCommit} onClose={() => onCloseCommitDetails(commit.id)}/>}</React.Fragment>; }; return <div className="ref-log"><hr/><h3>{title}</h3>{value.branchPoint && entry(value.branchPoint, true)}{value.commits.length === 0 ? <p>{ui.noCommitsFound}</p> : value.commits.map(commit => entry(commit))}</div>; }
function CommitFiles({ ui, value, onClose }: { ui: WebviewStrings; value: CommitDetails; onClose?: () => void }) { return <div className="commit-files">{onClose && <button className="close-commit-files" aria-label={ui.closeCommitFiles} title={ui.closeCommitFiles} onClick={onClose}>×</button>}<div className="metrics"><div><b>{value.files.length}</b><small>{ui.files}</small></div><div><b className="added">+{value.additions}</b><small>{ui.added}</small></div><div><b className="removed">−{value.deletions}</b><small>{ui.removed}</small></div></div>{value.files.length === 0 ? <p>{ui.noFileChanges}</p> : <div className="files">{value.files.map(file => <button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={() => vscode.postMessage({ type: 'openDiff', left: value.commit.id, right: value.parent ?? value.commit.id, path: file.path, oldPath: file.oldPath, status: file.status[0] })}><i className={file.status}>{file.status}</i><span>{file.path}</span><small><ins>+{file.additions ?? 0}</ins> <del>−{file.deletions ?? 0}</del></small></button>)}</div>}</div>; }
function Comparison({ ui, value }: { ui: WebviewStrings; value: BranchComparison }) { return <div className="results"><h3>{ui.comparison}</h3><div className="base"><small>{ui.mergeBase}</small><code>{value.mergeBases[0]?.slice(0, 9) ?? ui.none}</code></div><div className="metrics"><div><b>+{value.ahead}</b><small>{ui.onlyLeft}</small></div><div><b>{value.behind}</b><small>{ui.onlyRight}</small></div><div><b>{value.files.length}</b><small>{ui.files}</small></div></div><p className="stat"><ins>+{value.additions}</ins> <del>−{value.deletions}</del></p><h3>{ui.changedFiles}</h3><div className="files">{value.files.map(file => <button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={() => vscode.postMessage({ type: 'openDiff', left: value.left, right: value.right, path: file.path, oldPath: file.oldPath, status: file.status[0] })}><i className={file.status}>{file.status}</i><span>{file.path}</span></button>)}</div></div>; }
function branchState(data: GraphPayload, ref: GitRef, ui: WebviewStrings): string { if (ref.type === 'remoteBranch') return ' [R]'; if (ref.type !== 'localBranch') return ''; const head = isCurrentBranch(data, ref) ? ` [${ui.currentBranchMarker}]` : ''; const status = data.branchStatuses.find(item => item.ref === ref.fullName); if (!status?.remote) return `${head} [L]`; const movement = status.ahead || status.behind ? `${status.ahead ? ` ↑${status.ahead}` : ''}${status.behind ? ` ↓${status.behind}` : ''}` : ' ='; return `${head} [L][R]${movement}`; }
function isCurrentBranch(data: GraphPayload, ref: GitRef): boolean { return ref.type === 'localBranch' && ref.name === data.currentBranch; }
function commitMeta(ui: WebviewStrings, commit: CommitInfo): React.ReactNode { if (!commit.committer && !commit.date) return null; const date = commit.date ? formatCommitDate(commit.date) : ''; const label = ui.commitMeta(commit.committer ?? '', date); return <small className="commit-meta" title={commit.date}>{label}</small>; }
function formatCommitDate(value: string): string { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
function refIcon(ref: GitRef): string { return ref.type === 'tag' ? '◆' : ref.type === 'remoteBranch' ? '☁' : '⑂'; }
function displayRefName(name: string): string { return name.length > 18 ? `${name.slice(0, 17)}…` : name; }
function ContextMenu({ ui, menu, onRun }: { ui: WebviewStrings; menu: ContextMenuState; onRun: (command: GraphContextMenuItem['command']) => void }) { const groups: GraphContextMenuItem['group'][] = ['compare', 'graph', 'git', 'manage', 'copy']; return <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}><div className="context-title">{menu.selectedRefs.length === 2 ? ui.compareSelectedRefs : menu.ref?.name ?? menu.nodeId.slice(0, 8)}</div>{groups.map(group => { const items = menu.items.filter(item => item.visible && item.group === group); return items.length ? <React.Fragment key={group}><div className="context-group">{ui.contextGroup(group)}</div>{items.map(item => <button key={item.command} role="menuitem" disabled={!item.enabled} onClick={() => onRun(item.command)}>{item.label}</button>)}</React.Fragment> : null; })}</div>; }
