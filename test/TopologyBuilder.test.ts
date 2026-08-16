import { describe, expect, it } from 'vitest';
import { TopologyBuilder } from '../src/domain/TopologyBuilder';
import { CommitGraph } from '../src/domain/models';
function graph(): CommitGraph {
  const nodes = new Map();
  nodes.set('a',{id:'a',parents:['b'],refs:[{name:'main',fullName:'refs/heads/main',type:'localBranch',commitId:'a'}]});
  nodes.set('b',{id:'b',parents:['c'],refs:[]}); nodes.set('c',{id:'c',parents:['d'],refs:[]}); nodes.set('d',{id:'d',parents:[],refs:[]});
  return {nodes,order:['a','b','c','d']};
}
describe('TopologyBuilder',()=>{
  it('compresses ordinary linear commits',()=>{const view=new TopologyBuilder().build(graph(),'topology');expect(view.nodes.filter(n=>n.kind==='range')[0].range?.count).toBe(2);});
  it('expands one range without changing the DAG and keeps a collapse control',()=>{const builder=new TopologyBuilder();const compact=builder.build(graph(),'topology');const id=compact.nodes.find(n=>n.kind==='range')!.id;const expanded=builder.build(graph(),'topology',new Set([id]));expect(expanded.nodes.filter(n=>n.kind==='commit')).toHaveLength(4);expect(expanded.nodes.find(n=>n.id===id)?.range?.expanded).toBe(true);expect(graph().nodes.size).toBe(4);});
  it('shows every commit in full mode',()=>expect(new TopologyBuilder().build(graph(),'full').nodes).toHaveLength(4));
  it('preserves the loaded boundary when its parent is outside the walk',()=>{
    const value = graph();
    value.nodes.get('d')!.parents = ['not-loaded'];
    const view = new TopologyBuilder().build(value, 'topology');
    expect(view.nodes.find(node => node.id === 'd')?.kind).toBe('commit');
    expect(view.edges).toContainEqual({ from: 'a', to: 'd', hiddenCommitCount: 2 });
  });
  it('gives parallel collapsed merge paths distinct identities and lanes',()=>{
    const nodes = new Map();
    nodes.set('merge',{id:'merge',parents:['left-1','right-1'],refs:[{name:'main',fullName:'refs/heads/main',type:'localBranch',commitId:'merge'}]});
    nodes.set('left-1',{id:'left-1',parents:['base'],refs:[]});
    nodes.set('right-1',{id:'right-1',parents:['base'],refs:[]});
    nodes.set('base',{id:'base',parents:[],refs:[]});
    const view = new TopologyBuilder().build({nodes,order:['merge','left-1','right-1','base']},'topology');
    const ranges = view.nodes.filter(node => node.kind === 'range');
    expect(ranges.map(node => node.id)).toEqual([
      'range:merge:base:left-1',
      'range:merge:base:right-1'
    ]);
    expect(new Set(ranges.map(node => node.lane)).size).toBe(2);
  });
  it('does not drift right after consecutive collapsed histories',()=>{
    const nodes = new Map();
    nodes.set('a',{id:'a',parents:['a-hidden'],refs:[{name:'a',fullName:'refs/heads/a',type:'localBranch',commitId:'a'}]});
    nodes.set('a-hidden',{id:'a-hidden',parents:['a-root'],refs:[]});
    nodes.set('a-root',{id:'a-root',parents:[],refs:[]});
    nodes.set('b',{id:'b',parents:['b-hidden'],refs:[{name:'b',fullName:'refs/heads/b',type:'localBranch',commitId:'b'}]});
    nodes.set('b-hidden',{id:'b-hidden',parents:['b-root'],refs:[]});
    nodes.set('b-root',{id:'b-root',parents:[],refs:[]});

    const view = new TopologyBuilder().build({nodes,order:['a','a-hidden','a-root','b','b-hidden','b-root']},'topology');
    const commits = view.nodes.filter(node => node.kind === 'commit');
    const ranges = view.nodes.filter(node => node.kind === 'range');

    expect(commits.map(node => node.lane)).toEqual([0, 0, 0, 0]);
    expect(ranges.map(node => node.lane)).toEqual([0, 0]);
  });
  it('reuses side lanes after consecutive merges converge',()=>{
    const nodes = new Map();
    nodes.set('merge-2',{id:'merge-2',parents:['main-2','side-2'],refs:[{name:'main',fullName:'refs/heads/main',type:'localBranch',commitId:'merge-2'}]});
    nodes.set('main-2',{id:'main-2',parents:['merge-1'],refs:[]});
    nodes.set('side-2',{id:'side-2',parents:['merge-1'],refs:[]});
    nodes.set('merge-1',{id:'merge-1',parents:['main-1','side-1'],refs:[]});
    nodes.set('main-1',{id:'main-1',parents:['base'],refs:[]});
    nodes.set('side-1',{id:'side-1',parents:['base'],refs:[]});
    nodes.set('base',{id:'base',parents:[],refs:[]});
    const graph = {nodes,order:['merge-2','main-2','side-2','merge-1','main-1','side-1','base']};

    const topology = new TopologyBuilder().build(graph,'topology');
    const full = new TopologyBuilder().build(graph,'full');

    expect(topology.nodes.filter(node=>node.kind==='range').map(node=>node.lane)).toEqual([0,1,0,1]);
    expect(Math.max(...full.nodes.filter(node=>node.kind==='commit').map(node=>node.lane))).toBe(1);
  });
});
