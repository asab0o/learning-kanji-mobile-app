/**
 * drizzle-kit が生成する `src/db/migrations/migrations.js` は `.sql` を直接 import する。
 * 実行時は `babel.config.js` の `inline-import` が文字列に置き換えるが、
 * tsc はこの宣言が無いと「モジュールが見つからない」で落ちる。
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
