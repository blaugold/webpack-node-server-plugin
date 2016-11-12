
declare interface NodeRequire {
  context: any;
}

const ctx = require.context('./src', true, /\.ts$/);
ctx.keys().map(moduleName => ctx(moduleName));
