import frontendConfig from "./frontend/eslint.config.mjs";
export default [...frontendConfig, { ignores: ["**/.next/**", "**/node_modules/**", "**/next-env.d.ts", "**/test-results/**", "**/playwright-report/**"] }];
