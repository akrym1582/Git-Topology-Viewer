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
  it('expands one range without changing the DAG',()=>{const builder=new TopologyBuilder();const compact=builder.build(graph(),'topology');const id=compact.nodes.find(n=>n.kind==='range')!.id;const expanded=builder.build(graph(),'topology',new Set([id]));expect(expanded.nodes.filter(n=>n.kind==='commit')).toHaveLength(4);expect(graph().nodes.size).toBe(4);});
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
});
