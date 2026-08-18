import { describe, expect, it } from 'vitest';
import { webviewStrings } from '../src/webview/i18n';

describe('webview localization', () => {
  it('uses Japanese strings for Japanese display language variants', () => {
    const strings = webviewStrings('ja-JP');
    expect(strings.refresh).toBe('更新');
    expect(strings.relationGraph).toBe('Git 関係図');
    expect(strings.significantGraph).toBe('分岐・マージ');
    expect(strings.significantGraphUnavailable).toContain('分岐・マージを読み込めません');
    expect(strings.commitGraph).toBe('コミット履歴');
    expect(strings.commitGraphUnavailable).toContain('コミット履歴を読み込めません');
    expect(strings.commitsAndRefs(3, 2)).toBe('3 件のコミット · 2 個の参照');
    expect(strings.commitGroup(4)).toBe('4 件');
    expect(strings.commitGroupAriaLabel(4)).toBe('4 件の連続したコミットの概要');
    expect(strings.summarizeCommits).toBe('コミットを概要表示');
    expect(strings.showAllCommits).toBe('すべてのコミットを表示');
    expect(strings.readingRelations).toBe('ブランチの関係を読み込み中…');
    expect(strings.branchPoint).toBe('分岐点');
  });

  it('falls back to English for unsupported display languages', () => {
    expect(webviewStrings('fr').refresh).toBe('Refresh');
  });
});
