// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'src/db/migrations/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // docs/architecture.md: 相対パスの ../ を作らず @/ エイリアスを使う
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: "親ディレクトリへの相対 import は禁止です。'@/...' エイリアスを使ってください",
            },
          ],
        },
      ],
    },
  },
  {
    // 検証 CLI はビルド対象外なので、リポジトリ相対の import を許可する
    files: ['scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
