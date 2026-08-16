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
});
