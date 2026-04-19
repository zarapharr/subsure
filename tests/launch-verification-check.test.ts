import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const tsxPath = path.join(repoRoot, "node_modules", ".bin", "tsx");
const scriptPath = path.join(repoRoot, "scripts", "launch-verification-check.ts");

function runScript(args: string[]) {
  return spawnSync(tsxPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: path.join(repoRoot, ".env.does-not-exist"),
    },
  });
}

describe("launch verification check script", () => {
  it("passes in mock mode without auth cookie", () => {
    const result = runScript(["--mock-mode", "--expected-plaid-env", "development"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[PASS] Mock mode");
    expect(result.stdout).toContain("Final result: PASS");
  });

  it("fails in real mode when auth cookie is missing", () => {
    const result = runScript(["--skip-env-check"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Launch verification check failed to run");
    expect(result.stderr).toContain("Missing auth cookie");
  });
});
