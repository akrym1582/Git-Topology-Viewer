import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  publisher: string;
  icon: string;
  repository: { type: string; url: string };
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

describe('Visual Studio Marketplace metadata', () => {
  it('uses the configured publisher and a packaged PNG icon', () => {
    expect(manifest.publisher).toBe('ymknr1582');
    expect(manifest.icon).toBe('resources/topology.png');
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'https://github.com/akrym1582/Git-Topology-Viewer.git',
    });
    const icon = readFileSync(resolve(process.cwd(), manifest.icon));
    expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(icon.readUInt32BE(16)).toBe(128);
    expect(icon.readUInt32BE(20)).toBe(128);
    expect(icon[25]).toBe(6);
  });
});
