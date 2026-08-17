import React, { MouseEvent, useEffect, useMemo, useState } from 'react';
import { BranchComparison, GitRef, GraphPayload } from '../domain/models';
import { GraphContextMenuItem } from '../vscode/messages';
import { WebviewStrings, webviewStrings } from './i18n';
import { vscode } from './vscode';

interface ContextMenuState { ref: GitRef; selectedRefs: string[]; x: number; y: number; items: GraphContextMenuItem[] }

export function App() {
  const ui = webviewStrings(document.documentElement.lang);
  const dataRef = React.useRef<GraphPayload>();
  const [data, setData] = useState<GraphPayload>();
  const [comparison, setComparison] = useState<BranchComparison>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tags, setTags] = useState(true);
  const [remotes, setRemotes] = useState(false);
  const [selected, setSelected] = useState<GitRef[]>([]);
  const [menu, setMenu] = useState<ContextMenuState>();
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [inspectorWidth, setInspectorWidth] = useState(340);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'graph') { setData(event.data.payload); dataRef.current = event.data.payload; }
      if (event.data.type === 'comparison') setComparison(event.data.payload);
      if (event.data.type === 'error') setError(event.data.message);
      if (event.data.type === 'operationResult') setNotice(event.data.message);
      if (event.data.type === 'contextMenuItems') {
        const ref = dataRef.current?.refs.find(item => item.fullName === event.data.nodeId);
        if (ref) setMenu({ ref, selectedRefs: event.data.selectedRefs ?? [ref.fullName], x: event.data.x, y: event.data.y, items: event.data.items });
      }
      if (event.data.type === 'focusRef' && event.data.commitId) document.querySelector(`[data-ref-node="${event.data.commitId}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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

  const visibleRefs = useMemo(() => data?.graph.nodes.flatMap(node => node.refs) ?? [], [data]);
  if (!data) return <main className="loading"><div className="spinner"/><h2>{ui.readingRelations}</h2>{error && <p className="error">{error}</p>}</main>;
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
    setComparison(undefined);
    if (!additive) { setSelected([ref]); return; }
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
  const setRefVisibility = (nextTags: boolean, nextRemotes: boolean) => {
    setTags(nextTags); setRemotes(nextRemotes);
    vscode.postMessage({ type: 'setRefVisibility', tags: nextTags, remotes: nextRemotes });
  };

  return <div className="app" onContextMenu={event => event.preventDefault()}>
    <header><div className="brand"><span className="mark">⌁</span><div><strong>{ui.relationGraph}</strong><small>{data.repository}</small></div></div><button className="refresh" onClick={() => vscode.postMessage({ type: 'refresh' })}>↻ {ui.refresh}</button></header>
    <div className="filters"><label><input type="checkbox" checked={tags} onChange={event => setRefVisibility(event.target.checked, remotes)}/> {ui.tags}</label><label><input type="checkbox" checked={remotes} onChange={event => setRefVisibility(tags, event.target.checked)}/> {ui.remoteBranches}</label><button className="toggle-inspector" aria-pressed={inspectorVisible} onClick={() => setInspectorVisible(value => !value)}>{inspectorVisible ? ui.hideDetails : ui.showDetails}</button><span>{ui.nodesAndRefs(data.graph.nodes.length, visibleRefs.length)}</span></div>
    <div className={`content ${inspectorVisible ? '' : 'inspector-hidden'}`} style={inspectorVisible ? { gridTemplateColumns: `minmax(0, 1fr) 9px ${inspectorWidth}px` } : undefined}><Graph data={data} ui={ui} selected={new Set(selected.map(ref => ref.fullName))} onSelect={selectRef} onContextMenu={openContextMenu}/>{inspectorVisible && <><div className="inspector-resizer" role="separator" aria-orientation="vertical" aria-label={ui.resizeDetails} aria-valuemin={MIN_INSPECTOR_WIDTH} aria-valuemax={getMaxInspectorWidth()} aria-valuenow={inspectorWidth} tabIndex={0} title={ui.resizeDetails} onPointerDown={startInspectorResize} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); adjustInspectorWidth(16); } if (event.key === 'ArrowRight') { event.preventDefault(); adjustInspectorWidth(-16); } if (event.key === 'Home') { event.preventDefault(); setInspectorWidth(MIN_INSPECTOR_WIDTH); } if (event.key === 'End') { event.preventDefault(); setInspectorWidth(getMaxInspectorWidth()); } }}/><aside><Inspector ui={ui} selected={selected} refs={visibleRefs} comparison={comparison} onClose={() => setSelected([])}/></aside></>}</div>
    {menu && <ContextMenu ui={ui} menu={menu} onRun={command => { vscode.postMessage({ type: 'runContextCommand', command, nodeId: menu.ref.fullName, selectedRefs: menu.selectedRefs }); setMenu(undefined); }}/>}
    {error && <div className="toast">{error}</div>}
    {notice && <div className="toast success" role="status" onClick={() => setNotice('')}>{notice}</div>}
  </div>;
}

const MIN_INSPECTOR_WIDTH = 260;
const MAX_INSPECTOR_WIDTH = 620;
const MIN_GRAPH_WIDTH = 360;
function getMaxInspectorWidth(): number { return Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, window.innerWidth - MIN_GRAPH_WIDTH)); }

function Graph({ data, ui, selected, onSelect, onContextMenu }: { data: GraphPayload; ui: WebviewStrings; selected: Set<string>; onSelect: (ref: GitRef, additive: boolean) => void; onContextMenu: (ref: GitRef, event: MouseEvent) => void }) {
  const [zoom, setZoom] = useState(1);
  const refLayouts = new Map(data.graph.nodes.map(node => [node.id, layoutRefs(node.refs)]));
  const nodes = new Map(data.graph.nodes.map(node => [node.id, node]));
  const maxX = Math.max(800, ...data.graph.nodes.map(node => node.x + 300));
  const maxY = Math.max(600, ...data.graph.nodes.map(node => node.y + 100));
  const updateZoom = (next: number) => setZoom(Math.min(2, Math.max(0.5, Math.round(next * 10) / 10)));
  return <section className="canvas" onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)); } }}>
    <div className="zoom-controls" aria-label={ui.zoomControls}><button aria-label={ui.zoomOut} title={ui.zoomOut} disabled={zoom <= 0.5} onClick={() => updateZoom(zoom - 0.1)}>−</button><button aria-label={ui.resetZoom} title={ui.resetZoom} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label={ui.zoomIn} title={ui.zoomIn} disabled={zoom >= 2} onClick={() => updateZoom(zoom + 0.1)}>＋</button></div>
    <svg width={maxX * zoom} height={maxY * zoom}><g transform={`scale(${zoom})`}><g className="edges">{data.graph.edges.map(edge => { const from = nodes.get(edge.from); const to = nodes.get(edge.to); if (!from || !to) return null; const fromAnchor = refLayouts.get(from.id)!.anchor; const toAnchor = refLayouts.get(to.id)!.anchor; const fromX = from.x + fromAnchor.x; const fromY = from.y + fromAnchor.y; const toX = to.x + toAnchor.x; const toY = to.y + toAnchor.y; return <path key={`${edge.from}:${edge.to}`} d={`M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`}/>; })}</g>{data.graph.nodes.map(node => { const layout = refLayouts.get(node.id)!; return <g key={node.id} data-ref-node={node.id} className="node" transform={`translate(${node.x},${node.y})`}>{layout.refs.length > 1 && <g className="ref-connectors" aria-hidden="true">{layout.refs.slice(1).map(({ ref, position }) => <path key={ref.fullName} data-ref-connector={ref.fullName} d={`M ${layout.anchor.x} ${layout.anchor.y} V ${position.y - REF_ROW_GAP / 2} H ${position.x + REF_ICON_CENTER_X} V ${position.y + REF_ANCHOR_Y}`}/>)}</g>}{layout.refs.map(({ ref, position }) => <g key={ref.fullName} className={`ref ${ref.type} ${selected.has(ref.fullName) ? 'selected' : ''}`} transform={`translate(${position.x},${position.y})`} onClick={event => { event.stopPropagation(); onSelect(ref, event.ctrlKey || event.metaKey); }} onContextMenu={event => onContextMenu(ref, event)} role="button" aria-label={ui.branchAriaLabel(ref.name)}><rect width={REF_WIDTH} height={REF_HEIGHT} rx="0"/><text className="ref-icon" x="14" y={REF_TEXT_Y} textAnchor="middle">{refIcon(ref)}</text><text className="ref-name" x="24" y={REF_TEXT_Y}>{displayRefName(ref.name)}{branchState(data, ref)}</text></g>)}</g>; })}</g></svg><div className="selection-hint">{ui.selectionHint}</div></section>;
}

const REF_WIDTH = 150; const REF_HEIGHT = 28; const REF_ROW_GAP = 6; const REF_ICON_CENTER_X = 14; const REF_TEXT_Y = 19; const REF_ANCHOR_Y = REF_TEXT_Y - 5;
const REF_TYPES: GitRef['type'][] = ['tag', 'localBranch', 'remoteBranch'];
interface RefLayout { refs: Array<{ ref: GitRef; position: { x: number; y: number } }>; anchor: { x: number; y: number } }
function layoutRefs(refs: GitRef[]): RefLayout { const rows = REF_TYPES.flatMap(type => refs.filter(ref => ref.type === type)); const firstRowY = -((rows.length * REF_HEIGHT) + ((rows.length - 1) * REF_ROW_GAP)) / 2; const positionedRefs = rows.map((ref, rowIndex) => ({ ref, position: { x: -REF_ICON_CENTER_X, y: firstRowY + rowIndex * (REF_HEIGHT + REF_ROW_GAP) } })); const anchor = positionedRefs[0] ? { x: positionedRefs[0].position.x + REF_ICON_CENTER_X, y: positionedRefs[0].position.y + REF_ANCHOR_Y } : { x: 0, y: 0 }; return { refs: positionedRefs, anchor }; }

function Inspector({ ui, selected, refs, comparison, onClose }: { ui: WebviewStrings; selected: GitRef[]; refs: GitRef[]; comparison?: BranchComparison; onClose: () => void }) { const primary = selected[0]; const [other, setOther] = useState(''); const [mode, setMode] = useState<'divergence' | 'snapshot'>('divergence'); useEffect(() => setOther(selected[1]?.fullName ?? refs.find(ref => ref.fullName !== primary?.fullName)?.fullName ?? ''), [primary, selected[1], refs]); if (!primary) return <div className="empty"><span>⑂</span><h3>{ui.selectBranchOrTag}</h3><p>{ui.selectBranchOrTagHint}</p></div>; const compare = () => vscode.postMessage({ type: 'compareRefs', left: primary.fullName, right: other, mode }); return <div className="inspector"><button className="close" aria-label={ui.closeInspector} title={ui.closeInspector} onClick={onClose}>×</button><small>{selected.length === 2 ? ui.comparingRefs : primary.type.replace(/([A-Z])/g, ' $1').toUpperCase()}</small><h2>{selected.length === 2 ? `${primary.name} ↔ ${selected[1].name}` : primary.name}</h2><div className="actions"><button onClick={() => vscode.postMessage({ type: 'copy', value: primary.name })}>{ui.copyName}</button></div><hr/><h3>{ui.compareWith}</h3><select value={other} onChange={event => setOther(event.target.value)}>{refs.filter(ref => ref.fullName !== primary.fullName).map(ref => <option key={ref.fullName} value={ref.fullName}>{ref.name}</option>)}</select><label className="radio"><input type="radio" checked={mode === 'divergence'} onChange={() => setMode('divergence')}/> {ui.changesSinceDivergence}</label><label className="radio"><input type="radio" checked={mode === 'snapshot'} onChange={() => setMode('snapshot')}/> {ui.currentSnapshots}</label><button className="primary" disabled={!other} onClick={compare}>{ui.compareRefs}</button>{comparison && comparison.left === primary.fullName && <Comparison ui={ui} value={comparison}/>}</div>; }
function Comparison({ ui, value }: { ui: WebviewStrings; value: BranchComparison }) { return <div className="results"><h3>{ui.comparison}</h3><div className="base"><small>{ui.mergeBase}</small><code>{value.mergeBases[0]?.slice(0, 9) ?? ui.none}</code></div><div className="metrics"><div><b>+{value.ahead}</b><small>{ui.onlyLeft}</small></div><div><b>{value.behind}</b><small>{ui.onlyRight}</small></div><div><b>{value.files.length}</b><small>{ui.files}</small></div></div><p className="stat"><ins>+{value.additions}</ins> <del>−{value.deletions}</del></p><h3>{ui.changedFiles}</h3><div className="files">{value.files.map(file => <button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={() => vscode.postMessage({ type: 'openDiff', left: value.left, right: value.right, path: file.path, oldPath: file.oldPath, status: file.status[0] })}><i className={file.status}>{file.status}</i><span>{file.path}</span></button>)}</div></div>; }
function branchState(data: GraphPayload, ref: GitRef): string { if (ref.type === 'remoteBranch') return ' [R]'; if (ref.type !== 'localBranch') return ''; const status = data.branchStatuses.find(item => item.ref === ref.fullName); if (!status?.remote) return ' [L]'; const movement = status.ahead || status.behind ? `${status.ahead ? ` ↑${status.ahead}` : ''}${status.behind ? ` ↓${status.behind}` : ''}` : ' ='; return ` [L][R]${movement}`; }
function refIcon(ref: GitRef): string { return ref.type === 'tag' ? '◆' : ref.type === 'remoteBranch' ? '☁' : '⑂'; }
function displayRefName(name: string): string { return name.length > 18 ? `${name.slice(0, 17)}…` : name; }
function ContextMenu({ ui, menu, onRun }: { ui: WebviewStrings; menu: ContextMenuState; onRun: (command: GraphContextMenuItem['command']) => void }) { const groups: GraphContextMenuItem['group'][] = ['compare', 'graph', 'git', 'manage', 'copy']; return <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}><div className="context-title">{menu.selectedRefs.length === 2 ? ui.compareSelectedRefs : menu.ref.name}</div>{groups.map(group => { const items = menu.items.filter(item => item.visible && item.group === group); return items.length ? <React.Fragment key={group}><div className="context-group">{ui.contextGroup(group)}</div>{items.map(item => <button key={item.command} role="menuitem" disabled={!item.enabled} onClick={() => onRun(item.command)}>{item.label}</button>)}</React.Fragment> : null; })}</div>; }
