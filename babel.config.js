module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Drizzle のマイグレーション .sql を JS にインラインするために必要
      // (docs/data-model.md「マイグレーション」参照)
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
