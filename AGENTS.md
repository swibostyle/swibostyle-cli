# Agent Instructions

このリポジトリで作業する際は、まず `CLAUDE.md` を読んでプロジェクト構成を理解してください。

## 必読ドキュメント

1. **CLAUDE.md** - プロジェクト概要、フォルダ構成、コマンド一覧
2. **docs/ARCHITECTURE.md** - 詳細設計書（アダプターパターン、型定義など）

## 作業前チェックリスト

```bash
bun install          # 依存関係の確認
bun run check        # typecheck + lint + format:check
bun test             # テストが通ることを確認
```

## コード変更時の注意

- oxlint: `@typescript-eslint/no-unused-vars` で未使用変数はエラー（`_`プレフィックスで回避可）
- oxfmt: 保存時に自動フォーマットされる前提
- TypeScript: strict mode、`noUncheckedIndexedAccess: true`

## コミット前

```bash
bun run check        # 必ず実行
bun test             # テストが通ることを確認
```

## パッケージ間の依存関係

```
cli → core
pdf-server → core (AGPL分離)
create-swibostyle (独立)
```

coreパッケージを変更した場合、cliとpdf-serverへの影響を確認してください。
