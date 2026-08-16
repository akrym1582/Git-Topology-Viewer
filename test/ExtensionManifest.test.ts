import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  activationEvents: string[];
  contributes: {
    viewsContainers: { activitybar: Array<{ id: string; icon: string }> };
    views: Record<string, Array<{ id: string }>>;
    viewsWelcome: Array<{ view: string; contents: string }>;
  };
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as ExtensionManifest;

describe('extension launcher contributions', () => {
  it('exposes the viewer from an Activity Bar container', () => {
    expect(manifest.contributes.viewsContainers.activitybar).toContainEqual(
      expect.objectContaining({ id: 'gitTopology', icon: 'resources/topology.svg' }),
    );
    expect(manifest.contributes.views.gitTopology).toContainEqual({
      id: 'gitTopology.launcher',
      name: 'Git Topology Viewer',
    });
    expect(manifest.activationEvents).toContain('onView:gitTopology.launcher');
  });

  it('offers the existing open command in the launcher welcome view', () => {
    expect(manifest.contributes.viewsWelcome).toContainEqual(
      expect.objectContaining({
        view: 'gitTopology.launcher',
        contents: expect.stringContaining('(command:gitTopology.open)'),
      }),
    );
  });
});
