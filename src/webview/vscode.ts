declare function acquireVsCodeApi(): { postMessage(value: unknown): void };
export const vscode = acquireVsCodeApi();
