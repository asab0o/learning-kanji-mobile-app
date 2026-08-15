import type { Config } from 'drizzle-kit';

// 生成物は src/db/migrations/ に出る。手で編集しないこと(docs/data-model.md)
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
