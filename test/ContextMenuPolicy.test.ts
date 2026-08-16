import { describe, expect, it } from 'vitest';
import { ContextMenuPolicy } from '../src/vscode/ContextMenuPolicy';
import { GitRef } from '../src/domain/models';
const ref=(name:string,type:GitRef['type']):GitRef=>({name,type,fullName:type==='localBranch'?`refs/heads/${name}`:`refs/remotes/${name}`,commitId:'a'});
describe('ContextMenuPolicy',()=>{ const policy=new ContextMenuPolicy(), operation={type:'normal' as const,hasConflicts:false};
  it('disables deleting the current branch',()=>expect(policy.branchItems({ref:ref('main','localBranch'),currentBranch:'main',hasUpstream:true,operation}).find(x=>x.command==='deleteLocal')?.enabled).toBe(false));
  it('offers checkout and remote deletion only for a remote-only branch',()=>expect(policy.branchItems({ref:ref('origin/topic','remoteBranch'),currentBranch:'main',hasUpstream:false,operation}).map(x=>x.command)).toEqual(['checkoutRemote','fetch','deleteRemote']));
});
