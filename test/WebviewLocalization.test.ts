import { describe, expect, it } from 'vitest';
import { webviewStrings } from '../src/webview/i18n';

describe('webview localization', () => {
  it('uses Japanese strings for Japanese display language variants', () => {
    const strings = webviewStrings('ja-JP');
    expect(strings.refresh).toBe('更新');
    expect(strings.relationGraph).toBe('Git 関係図');
    expect(strings.commitGraph).toBe('コミット履歴');
    expect(strings.commitsAndRefs(3, 2)).toBe('3 件のコミット · 2 個の参照');
    expect(strings.readingRelations).toBe('ブランチの関係を読み込み中…');
    expect(strings.branchPoint).toBe('分岐点');
  });

  it('falls back to English for unsupported display languages', () => {
    expect(webviewStrings('fr').refresh).toBe('Refresh');
  });
});
