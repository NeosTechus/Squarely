/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["./eslint.base.cjs", "expo"],
  plugins: ["react", "react-hooks"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
