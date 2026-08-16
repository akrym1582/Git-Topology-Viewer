import React, { MouseEvent, useEffect, useMemo, useState } from 'react';
import { BranchComparison, GitRef, GraphPayload, RefLog, ViewMode } from '../domain/models';
import { vscode } from './vscode';

interface ContextMenuState { ref: GitRef; x: number; y: number }

export function App() {
  const [data, setData] = useState<GraphPayload>();
  const [comparison, setComparison] = useState<BranchComparison>();
  const [refLog, setRefLog] = useState<RefLog>();
  const [error, setError] = useState('');
  const [tags, setTags] = useState(true);
  const [remotes, setRemotes] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<GitRef[]>([]);
  const [menu, setMenu] = useState<ContextMenuState>();

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'graph') setData(event.data.payload);
      if (event.data.type === 'comparison') setComparison(event.data.payload);
      if (event.data.type === 'refLog') setRefLog(event.data.payload);
      if (event.data.type === 'error') setError(event.data.message);
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

  if (!data) return <main className="loading"><div className="spinner"/><h2>Reading commit topology…</h2>{error && <p className="error">{error}</p>}</main>;
  const refs = data.refs.filter(ref => allowed.has(ref.fullName));
  const selectRef = (ref: GitRef, additive: boolean) => {
    setRefLog(undefined);
    setComparison(undefined);
    if (!additive) {
      setSelected([ref]);
      return;
    }
    const without = selected.filter(item => item.fullName !== ref.fullName);
    if (without.length !== selected.length) {
      setSelected(without);
      return;
    }
    const next = [...without.slice(-1), ref];
    setSelected(next);
    if (next.length === 2) vscode.postMessage({ type: 'compareRefs', left: next[0].fullName, right: next[1].fullName, mode: 'divergence' });
  };
  const openContextMenu = (ref: GitRef, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selected.some(item => item.fullName === ref.fullName)) setSelected([ref]);
    setMenu({ ref, x: event.clientX, y: event.clientY });
  };
  const showLog = (ref: GitRef) => {
    setSelected([ref]);
    setComparison(undefined);
    setRefLog(undefined);
    vscode.postMessage({ type: 'showRefLog', ref: ref.fullName });
    setMenu(undefined);
  };

  return <div className="app" onContextMenu={event => event.preventDefault()}>
    <header><div className="brand"><span className="mark">⌁</span><div><strong>Git Topology</strong><small>{data.repository}</small></div></div><div className="modes">{(['topology','compact','full'] as ViewMode[]).map(mode => <button key={mode} className={data.mode === mode ? 'active' : ''} onClick={() => vscode.postMessage({type:'setViewMode',mode})}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div><button className="refresh" onClick={() => vscode.postMessage({type:'refresh'})}>↻ Refresh</button></header>
    <div className="filters"><label><input type="checkbox" checked readOnly/> Local branches</label><label><input type="checkbox" checked={tags} onChange={event=>setTags(event.target.checked)}/> Tags</label><label><input type="checkbox" checked={remotes} onChange={event=>setRemotes(event.target.checked)}/> Remote branches</label><input className="search" placeholder="Filter branches…" value={filter} onChange={event=>setFilter(event.target.value)}/><span>{data.graph.nodes.filter(node=>node.kind==='commit').length} nodes · {refs.length} refs</span></div>
    <div className="content"><Graph data={data} allowed={allowed} selected={new Set(selected.map(ref => ref.fullName))} onSelect={selectRef} onContextMenu={openContextMenu}/><aside><Inspector selected={selected} refs={refs} comparison={comparison} refLog={refLog} onClose={()=>setSelected([])}/></aside></div>
    {menu && <div className="context-menu" role="menu" style={{left:menu.x,top:menu.y}} onClick={event=>event.stopPropagation()}><div className="context-title">{menu.ref.name}</div><button role="menuitem" onClick={()=>showLog(menu.ref)}>View branch log</button><button role="menuitem" onClick={()=>{selectRef(menu.ref,true);setMenu(undefined);}}>Add to comparison</button></div>}
    {error && <div className="toast">{error}</div>}
  </div>;
}

function Graph({data, allowed, selected, onSelect, onContextMenu}:{data:GraphPayload;allowed:Set<string>;selected:Set<string>;onSelect:(ref:GitRef,additive:boolean)=>void;onContextMenu:(ref:GitRef,event:MouseEvent)=>void}) {
  const commits = new Map(data.graph.nodes.filter(node=>node.commit).map(node=>[node.id,node]));
  const maxX=Math.max(800,...data.graph.nodes.map(node=>node.x+300)), maxY=Math.max(600,...data.graph.nodes.map(node=>node.y+100));
  return <section className="canvas"><svg width={maxX} height={maxY}>
    <g className="edges">{data.graph.edges.map((edge,index)=>{const from=commits.get(edge.from),to=commits.get(edge.to);if(!from||!to)return null;return <path key={`${edge.from}:${edge.to}:${index}`} d={`M ${from.x} ${from.y} C ${from.x} ${(from.y+to.y)/2}, ${to.x} ${(from.y+to.y)/2}, ${to.x} ${to.y}`} />})}</g>
    {data.graph.nodes.map(node=>node.kind==='range'?<g key={node.id} className="range" transform={`translate(${node.x},${node.y})`} onClick={()=>vscode.postMessage({type:'expandRange',rangeId:node.id})}><rect x="-8" y="-17" width="118" height="34" rx="17"/><text x="10" y="5">+{node.range!.count} commits</text></g>:<g key={node.id} className="node" transform={`translate(${node.x},${node.y})`}><circle r={node.commit!.refs.length?8:6}/><text className="sha" x="18" y="5">{node.id.slice(0,7)}</text>{node.commit!.refs.filter(ref=>allowed.has(ref.fullName)).map((ref,index)=><g key={ref.fullName} className={`ref ${ref.type} ${selected.has(ref.fullName)?'selected':''}`} transform={`translate(${78+index*120},-14)`} onClick={event=>{event.stopPropagation();onSelect(ref,event.ctrlKey||event.metaKey);}} onContextMenu={event=>onContextMenu(ref,event)} role="button" aria-label={`${ref.name} branch`}><rect width="112" height="28" rx="5"/><text x="9" y="19">{ref.type==='tag'?'◆ ':ref.type==='remoteBranch'?'☁ ':'⑂ '}{ref.name.length>13?ref.name.slice(0,12)+'…':ref.name}</text></g>)}</g>)}
  </svg><div className="selection-hint">Click to select · Ctrl/Cmd-click two refs to compare · Right-click for branch log</div></section>;
}

function Inspector({selected,refs,comparison,refLog,onClose}:{selected:GitRef[];refs:GitRef[];comparison?:BranchComparison;refLog?:RefLog;onClose:()=>void}) {
  const primary=selected[0];
  const [other,setOther]=useState(''),[mode,setMode]=useState<'divergence'|'snapshot'>('divergence');
  useEffect(()=>setOther(selected[1]?.fullName ?? refs.find(ref=>ref.fullName!==primary?.fullName)?.fullName ??''),[primary, selected[1], refs]);
  if (!primary) return <div className="empty"><span>⑂</span><h3>Select a branch or tag</h3><p>Ctrl/Cmd-click two refs to compare them, or right-click a ref to view its log.</p></div>;
  const compare=()=>vscode.postMessage({type:'compareRefs',left:primary.fullName,right:other,mode});
  return <div className="inspector"><button className="close" aria-label="Close inspector" title="Close inspector" onClick={onClose}>×</button><small>{selected.length===2?'COMPARING REFS':primary.type.replace(/([A-Z])/g,' $1').toUpperCase()}</small><h2>{selected.length===2?`${primary.name} ↔ ${selected[1].name}`:primary.name}</h2><code>{primary.commitId.slice(0,12)}</code><div className="actions"><button onClick={()=>vscode.postMessage({type:'copy',value:primary.name})}>Copy name</button><button onClick={()=>vscode.postMessage({type:'copy',value:primary.commitId})}>Copy SHA</button></div>{refLog?.ref===primary.fullName?<RefLogView value={refLog}/>:<><hr/><h3>Compare with</h3><select value={other} onChange={event=>setOther(event.target.value)}>{refs.filter(ref=>ref.fullName!==primary.fullName).map(ref=><option key={ref.fullName} value={ref.fullName}>{ref.name}</option>)}</select><label className="radio"><input type="radio" checked={mode==='divergence'} onChange={()=>setMode('divergence')}/> Changes since divergence</label><label className="radio"><input type="radio" checked={mode==='snapshot'} onChange={()=>setMode('snapshot')}/> Current snapshots</label><button className="primary" disabled={!other} onClick={compare}>Compare refs</button>{comparison&&comparison.left===primary.fullName&&<Comparison value={comparison}/>}</>}</div>;
}
function RefLogView({value}:{value:RefLog}) { return <div className="ref-log"><hr/><h3>Branch log</h3>{value.commits.length===0?<p>No commits found.</p>:value.commits.map(commit=><div className="log-entry" key={commit.id}><code>{commit.id.slice(0,8)}</code><span>{commit.subject}</span></div>)}</div>; }
function Comparison({value}:{value:BranchComparison}) { return <div className="results"><h3>Comparison</h3><div className="base"><small>MERGE BASE</small><code>{value.mergeBases[0]?.slice(0,9)??'None'}</code></div><div className="metrics"><div><b>+{value.ahead}</b><small>only left</small></div><div><b>{value.behind}</b><small>only right</small></div><div><b>{value.files.length}</b><small>files</small></div></div><p className="stat"><ins>+{value.additions}</ins> <del>−{value.deletions}</del></p><h3>Changed files</h3><div className="files">{value.files.map(file=><button key={`${file.status}:${file.oldPath ?? ''}:${file.path}`} onClick={()=>vscode.postMessage({type:'openDiff',left:value.left,right:value.right,path:file.path,oldPath:file.oldPath,status:file.status[0]})}><i className={file.status}>{file.status}</i><span>{file.path}</span></button>)}</div></div> }
