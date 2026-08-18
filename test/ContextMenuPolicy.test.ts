import { describe, expect, it } from 'vitest';
import { ContextMenuPolicy } from '../src/vscode/ContextMenuPolicy';
import { GitRef } from '../src/domain/models';
const ref=(name:string,type:GitRef['type']):GitRef=>({name,type,fullName:type==='localBranch'?`refs/heads/${name}`:`refs/remotes/${name}`,commitId:'a'});
describe('ContextMenuPolicy',()=>{ const policy=new ContextMenuPolicy(), operation={type:'normal' as const,hasConflicts:false};
  it('returns comparison-only actions for two selected refs',()=>expect(policy.comparisonItems().map(x=>x.command)).toEqual(['compareSelected','compareSelectedSnapshots','showSelectedMergeBase']));
  it('disables deleting the current branch',()=>expect(policy.branchItems({ref:ref('main','localBranch'),currentBranch:'main',hasUpstream:true,operation}).find(x=>x.command==='deleteLocal')?.enabled).toBe(false));
  it('offers checkout and remote deletion only for a remote-only branch',()=>expect(policy.branchItems({ref:ref('origin/topic','remoteBranch'),currentBranch:'main',hasUpstream:false,operation}).map(x=>x.command)).toEqual(['checkoutRemote','fetch','deleteRemote']));
  it('offers commit actions with comparison availability reflected in enabled state',()=>{
    const items = policy.commitItems({hasCurrentBranch:true,hasCompareBase:false,hasCompareTarget:true,hasMergeBaseTarget:true});
    expect(items.map(item => item.command)).toEqual(['showChanges','compareCurrent','compareBase','compareWith','showMergeBase','checkoutDetached','createBranch','createTag','cherryPick','revert','copyHash','copyMessage']);
    expect(items.find(item => item.command === 'compareCurrent')?.enabled).toBe(true);
    expect(items.find(item => item.command === 'compareBase')?.enabled).toBe(false);
  });
});
