/** Workspace ESLint config — shared rules live in packages/config/eslint. */
module.exports = {
  root: true,
  // require.resolve sidesteps ESLint's shareable-config name normalisation,
  // which would otherwise rewrite "@yaanam/config" and fail to find it.
  extends: [require.resolve('@yaanam/config/eslint')],
  rules: {
    // Off for the backend only: with emitDecoratorMetadata, Nest DI and
    // class-validator read runtime type metadata from VALUE imports. Rewriting
    // an injected service / DTO import to `import type` erases that metadata and
    // breaks injection and request validation at runtime.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
};
