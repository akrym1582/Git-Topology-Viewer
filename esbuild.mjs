import esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const common = { bundle: true, sourcemap: true, minify: false, logLevel: 'info' };
const contexts = await Promise.all([
  esbuild.context({
    ...common,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  }),
  esbuild.context({
    ...common,
    entryPoints: ['src/webview/index.tsx'],
    outfile: 'dist/webview.js',
    platform: 'browser',
    format: 'iife',
  }),
]);
if (watch) await Promise.all(contexts.map((c) => c.watch()));
else {
  await Promise.all(contexts.map((c) => c.rebuild()));
  await Promise.all(contexts.map((c) => c.dispose()));
}
