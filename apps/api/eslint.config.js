import config from "@pickleball/config/eslint/node.js";

/**
 * NestJS uses decorators heavily; loosen a couple of rules that misfire on
 * decorator metadata and DTO classes.
 */
export default [
  ...config,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
