// JS config (not JSON) so it can require the shared workspace config —
// ESLint 8's legacy resolver doesn't honor package `exports` subpaths in
// `extends`, but Node's require() does.
const base = require('@hrm/config/eslint/base');

module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    ...base.rules,
  },
};
