const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const pluginRequire = createRequire(
  require.resolve("@next/eslint-plugin-next"),
);
const { getRootDirs } = pluginRequire("./utils/get-root-dirs");
const root = path.resolve(__dirname, "../../..");
const roots = (rootDir) =>
  getRootDirs({ cwd: root, settings: { next: { rootDir } } });

test("Next resolves the exact configured frontend directory", () => {
  const pattern = path.join(root, "frontend").replaceAll("\\", "/") + "/";
  assert.deepEqual(roots(pattern), [pattern]);
});
test("relative, brace and array project roots stay directories only", () => {
  assert.deepEqual(roots("frontend/"), ["frontend/"]);
  assert.deepEqual(roots("{frontend,backend}/").sort(), [
    "backend/",
    "frontend/",
  ]);
  assert.deepEqual(roots(["frontend/", "backend/"]), ["frontend/", "backend/"]);
  assert.deepEqual(roots("package.json"), []);
});
test("the frontend workspace can resolve its own absolute root", () => {
  const previous = process.cwd();
  const frontend = path.join(root, "frontend");
  try {
    process.chdir(frontend);
    assert.deepEqual(roots(frontend.replaceAll("\\", "/") + "/"), [
      frontend.replaceAll("\\", "/") + "/",
    ]);
  } finally {
    process.chdir(previous);
  }
});
test("Next default root remains its current working directory", () => {
  assert.deepEqual(roots(undefined), [root]);
});
test("deeply nested brace and extglob patterns are rejected before parsing", () => {
  for (const pattern of [
    "{".repeat(4500) + "a,b" + "}".repeat(4500),
    "@(".repeat(3000) + "x" + ")".repeat(3000),
  ]) {
    assert.throws(() => roots(pattern), {
      code: "ERR_GLOB_PATTERN_COMPLEXITY",
    });
  }
});
test("the Next internal-link lint rule still detects an ordinary violation", async () => {
  const { ESLint } = require("eslint");
  const plugin = require("@next/eslint-plugin-next");
  const fixture = mkdtempSync(path.join(tmpdir(), "cozy-lint-"));
  try {
    mkdirSync(path.join(fixture, "pages"));
    writeFileSync(
      path.join(fixture, "pages", "index.js"),
      "export default function Page() {}",
    );
    const linter = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.jsx"],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { "@next/next": plugin },
          settings: { next: { rootDir: fixture.replaceAll("\\", "/") + "/" } },
          rules: { "@next/next/no-html-link-for-pages": "error" },
        },
      ],
    });
    const [result] = await linter.lintText(
      'export default function Page(){return <a href="/">Home</a>}',
      { filePath: "fixture.jsx" },
    );
    assert.equal(
      result.messages.filter(
        (m) => m.ruleId === "@next/next/no-html-link-for-pages",
      ).length,
      1,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("numeric brace ranges include every matching project root", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "cozy-range-"));
  try {
    for (let i = 1; i <= 20; i++) mkdirSync(path.join(fixture, "app" + i));
    const matches = roots(fixture.replaceAll("\\", "/") + "/app{1..20}");
    assert.equal(matches.length, 20);
    for (let i = 1; i <= 20; i++)
      assert.ok(
        matches.includes(path.join(fixture, "app" + i).replaceAll("\\", "/")),
      );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("brace expansion work is bounded before native globbing", () => {
  for (const pattern of [
    "app{1..1000000000}",
    "{a,b}".repeat(20),
    "{a,b,".repeat(100) + "x" + "}".repeat(100),
  ]) {
    assert.throws(() => roots(pattern), {
      code: "ERR_GLOB_PATTERN_COMPLEXITY",
    });
  }
});
