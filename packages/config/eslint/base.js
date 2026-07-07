/**
 * Shared, plugin-free ESLint rules for the HRM monorepo.
 *
 * Only rules that are safe in every environment live here — env-specific
 * parsers/plugins (Next core-web-vitals, @typescript-eslint) stay in each
 * app's own config. This encodes the one convention both apps share:
 * unused vars are errors, but `_`-prefixed args are intentionally ignored.
 */
module.exports = {
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
