import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  activationEvents: string[];
  contributes: {
    viewsContainers?: { activitybar: Array<{ id: string; icon: string }> };
    views?: Record<string, Array<{ id: string }>>;
    viewsWelcome?: Array<{ view: string; contents: string }>;
  };
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as ExtensionManifest;

describe('extension launcher contributions', () => {
  it('does not contribute an Activity Bar container', () => {
    expect(manifest.contributes.viewsContainers).toBeUndefined();
    expect(manifest.contributes.views).toBeUndefined();
    expect(manifest.contributes.viewsWelcome).toBeUndefined();
  });

  it('activates after startup so the status bar launcher can be shown', () => {
    expect(manifest.activationEvents).toContain('onStartupFinished');
  });
});
