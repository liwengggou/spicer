#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const { transformSync } = require("esbuild")

const root = path.resolve(__dirname, "..")

function registerExtension(ext, loader) {
  require.extensions[ext] = function (module, filename) {
    const source = fs.readFileSync(filename, "utf8")
    const { code } = transformSync(source, {
      loader,
      format: "cjs",
      target: "node20",
      sourcemap: false,
    })
    module._compile(code, filename)
  }
}

registerExtension(".ts", "ts")
registerExtension(".tsx", "tsx")

const harness = require(path.join(root, "test", "harness"))
if (typeof harness.resetResults === "function") {
  harness.resetResults()
}

const testFiles = [
  path.join(root, "components", "CreateGroup.test.ts"),
  path.join(root, "lib", "preferences.test.ts"),
  path.join(root, "lib", "challengeValidation.test.ts"),
]

let failures = 0
for (const file of testFiles) {
  try {
    require(file)
  } catch (err) {
    failures += 1
    console.error(`Failed to load ${path.relative(root, file)}:`, err)
  }
}

const summary = typeof harness.getResults === "function" ? harness.getResults() : null
if (summary) {
  summary.logs.forEach((log) => console.error(log))
  console.log(`Tests passed: ${summary.passed}`)
  console.log(`Tests failed: ${summary.failed}`)
  failures += summary.failed
}

if (failures > 0) {
  process.exitCode = 1
  console.error("Tests failed.")
} else {
  console.log("All tests passed.")
}
