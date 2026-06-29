/** Workspace ESLint config — shared rules live in packages/config/eslint. */
module.exports = {
  root: true,
  // require.resolve sidesteps ESLint's shareable-config name normalisation,
  // which would otherwise rewrite "@yaanam/config" and fail to find it.
  extends: [require.resolve('@yaanam/config/eslint')],
};
