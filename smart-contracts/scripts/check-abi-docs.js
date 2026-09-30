#!/usr/bin/env node
/**
 * scripts/check-abi-docs.js
 *
 * CI guard: verifies that the ABI documentation committed in docs/abi/ is in
 * sync with the Soroban contract sources under contracts/*/src/lib.rs.
 *
 * Strategy
 * --------
 * For each contract source file we extract a "fingerprint" — the sorted list
 * of public function names exposed through #[contractimpl] blocks — and compare
 * it against the set of function headings (`####`) documented in the
 * corresponding docs/abi/<contract>.md file.
 *
 * If any public function present in source is missing from the docs (or vice
 * versa), the script exits with a non-zero code so CI can fail the build.
 *
 * This is intentionally lightweight: it does *not* require a full Rust toolchain
 * or soroban-spec binary, only Node.js, making it fast and always available
 * in CI environments that already run the TypeScript SDK checks.
 *
 * Usage
 * -----
 *   node scripts/check-abi-docs.js          # check only
 *   node scripts/check-abi-docs.js --fix    # print diff (no auto-fix; human must update docs)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const ABI_DOCS_DIR = path.join(ROOT, "docs", "abi");

// Map from Cargo crate directory name → ABI doc filename (without .md)
const CONTRACT_MAP = {
  agent_registry: "agent-registry",
  agent_bidding: "agent-bidding",
  "error-registry": "error-registry",
  task_store: "task-store",
  agent_governance: "agent-governance",
};

// Functions intentionally excluded from the ABI doc check because they are
// internal Rust helpers exposed via `pub fn` but not part of #[contractimpl].
const EXCLUDED_FN_PREFIXES = ["default_config", "from", "try_from", "into"];

/**
 * Extract public function names from a Rust lib.rs file.
 * Looks for lines matching: `    pub fn <name>(` inside `impl` blocks.
 */
function extractSourceFunctions(libRsPath) {
  if (!fs.existsSync(libRsPath)) return [];
  const src = fs.readFileSync(libRsPath, "utf8");
  const fns = new Set();
  // Match `pub fn name(` at the start of lines (with any indentation)
  const re = /^\s+pub fn ([a-z_][a-zA-Z0-9_]*)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (!EXCLUDED_FN_PREFIXES.some((p) => name.startsWith(p))) {
      fns.add(name);
    }
  }
  return [...fns].sort();
}

/**
 * Extract documented function names from an ABI markdown file.
 * Looks for lines like: `#### `name(...)`
 */
function extractDocFunctions(docPath) {
  if (!fs.existsSync(docPath)) return [];
  const content = fs.readFileSync(docPath, "utf8");
  const fns = new Set();
  // Match h4 headings: #### `fn_name(...)` or #### fn_name(...)
  const re = /^####\s+`?([a-z_][a-zA-Z0-9_]*)\s*\(/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    fns.add(m[1]);
  }
  return [...fns].sort();
}

let exitCode = 0;

for (const [crateDir, docSlug] of Object.entries(CONTRACT_MAP)) {
  const libRs = path.join(CONTRACTS_DIR, crateDir, "src", "lib.rs");
  const docMd = path.join(ABI_DOCS_DIR, `${docSlug}.md`);

  if (!fs.existsSync(libRs)) {
    console.warn(`[WARN] Source not found: ${libRs} — skipping`);
    continue;
  }
  if (!fs.existsSync(docMd)) {
    console.error(`[FAIL] ABI doc missing: ${docMd}`);
    exitCode = 1;
    continue;
  }

  const srcFns = extractSourceFunctions(libRs);
  const docFns = extractDocFunctions(docMd);

  const srcSet = new Set(srcFns);
  const docSet = new Set(docFns);

  const undocumented = srcFns.filter((f) => !docSet.has(f));
  const obsolete = docFns.filter((f) => !srcSet.has(f));

  if (undocumented.length === 0 && obsolete.length === 0) {
    console.log(`[OK]   ${docSlug}: ${srcFns.length} functions — docs in sync`);
  } else {
    console.error(`[FAIL] ${docSlug}: ABI docs are out of sync`);
    if (undocumented.length > 0) {
      console.error(`       Missing from docs (add to ${docMd}):`);
      undocumented.forEach((f) => console.error(`         - ${f}`));
    }
    if (obsolete.length > 0) {
      console.error(`       Documented but not in source (remove from ${docMd}):`);
      obsolete.forEach((f) => console.error(`         - ${f}`));
    }
    exitCode = 1;
  }
}

if (exitCode !== 0) {
  console.error(
    "\nABI docs are out of sync. Update docs/abi/ to match the contract sources and re-commit."
  );
}

process.exit(exitCode);
