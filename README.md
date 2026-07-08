# Web参考サイト

参考サイトを毎日1つ見て、良いところを1つだけ小さく再現して残すためのプロジェクトです。

## 毎日の流れ

```bash
npm run new -- --url https://example.com --title "サイト名" --detail "今回抜き出す要素" --tags hover,scroll
```

作成された `sites/YYYY-MM-DD-slug/` の `memo.md` と `demo/` をCodexで編集します。

```bash
npm run build
npm run check
npm run preview
```

`public/` が公開用サイトです。GitHub Pages / Netlify / Vercel / Cloudflare Pages にはこの `public/` を公開します。

`npm run check` は `public/` を再生成し、公開候補に秘密鍵・トークン・パスワード・ローカルパス・危険なURLクエリが含まれていないか確認します。

## ディレクトリ

```text
sites/       原本。メモとデモを日付ごとに保存
public/      公開用。npm run build で再生成
scripts/     作成・ビルド・プレビュー用スクリプト
.codex/      この運用専用のCodexスキル
```

`.codex/` と `.env*` は `.gitignore` で除外しています。スキル本体や環境変数は公開リポジトリに載せません。

## Codexに頼む時の型

```text
Use $stock-reference-site

URL: ...
良いと思ったところ:
- ...
- ...

今回は「...」だけを小さく再現して。
```
