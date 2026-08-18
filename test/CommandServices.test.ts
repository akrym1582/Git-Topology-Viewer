import { describe, expect, it, vi } from 'vitest';
import { GitClient } from '../src/git/GitClient';
import { BranchOperationService } from '../src/git/BranchOperationService';
import { StashOperationService } from '../src/git/StashOperationService';
import { CommitOperationService } from '../src/git/CommitOperationService';

const mock = () => { const run=vi.fn().mockResolvedValue(''); return { run, git:{run} as unknown as GitClient }; };
describe('mutating Git command services', () => {
  it('constructs remote, merge, rebase and deletion commands safely', async () => {
    const {run,git}=mock(); const service=new BranchOperationService(git);
    await service.push('topic','origin',true); await service.fetch('origin'); await service.checkoutRemote('origin/topic','topic');
    await service.mergeIntoCurrent('topic'); await service.rebaseCurrentOnto('main'); await service.deleteLocalBranch('old',false); await service.deleteLocalBranch('old',true); await service.deleteRemoteBranch('origin','old');
    expect(run.mock.calls).toContainEqual([['push','-u','origin','topic']]); expect(run.mock.calls).toContainEqual([['fetch','origin']]);
    expect(run.mock.calls).toContainEqual([['switch','--track','-c','topic','--','origin/topic']]); expect(run.mock.calls).toContainEqual([['merge','--no-edit','--','topic']]);
    expect(run.mock.calls).toContainEqual([['rebase','main']]); expect(run.mock.calls).toContainEqual([['branch','-d','--','old']]); expect(run.mock.calls).toContainEqual([['branch','-D','--','old']]); expect(run.mock.calls).toContainEqual([['push','origin','--delete','old']]);
  });
  it('constructs stash, commit, detached checkout, and tag commands', async () => { const {run,git}=mock(); const stash=new StashOperationService(git), commit=new CommitOperationService(git); await stash.apply('stash@{0}'); await stash.pop('stash@{0}'); await stash.drop('stash@{0}'); await commit.checkoutDetached('abc'); await commit.createTag('v1.0', 'abc'); await commit.cherryPick('abc'); await commit.revert('def'); expect(run.mock.calls.map(call=>call[0])).toEqual([['stash','apply','stash@{0}'],['stash','pop','stash@{0}'],['stash','drop','stash@{0}'],['switch','--detach','--','abc'],['tag','v1.0','abc'],['cherry-pick','abc'],['revert','def']]); });
  it('refuses dirty merge/rebase before invoking them', async () => { const {run,git}=mock(); run.mockResolvedValue(' M file\n'); const service=new BranchOperationService(git); await expect(service.mergeIntoCurrent('topic')).resolves.toMatchObject({success:false,errorType:'dirtyWorkingTree'}); await expect(service.rebaseCurrentOnto('main')).resolves.toMatchObject({success:false,errorType:'dirtyWorkingTree'}); expect(run).not.toHaveBeenCalledWith(expect.arrayContaining(['merge'])); });
});
