import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

// Execute the actual deployment script with isolated Docker/curl shims. No server is contacted.
const bash =
  process.env.BASH_PATH ??
  (process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash");
const root = resolve("work/deploy-tests");
mkdirSync(root, { recursive: true });
const tag = `sha-${"a".repeat(40)}`;
const previous = `sha-${"b".repeat(40)}`;
const unix = (path) =>
  path
    .replaceAll("\\", "/")
    .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
const docker = `#!/usr/bin/env bash
printf '%s|%s\\n' "$IMAGE_TAG" "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  'compose config --environment') echo 'APP_ORIGIN=https://credit.example.test';;
  'compose run --rm init') [[ "$DEPLOY_TEST_FAIL" != init ]] || exit 42;;
  'compose up -d --no-deps --wait --wait-timeout 120 app')
    [[ "$DEPLOY_TEST_FAIL" != app || "$IMAGE_TAG" == "$DEPLOY_TEST_PREVIOUS" ]] || exit 43;;
  *'exec -T caddy caddy reload'*) [[ "$DEPLOY_TEST_FAIL" != proxy ]] || exit 44;;
esac
exit 0
`;
for (const [failure, code] of [
  ["none", 0],
  ["init", 42],
  ["app", 43],
  ["proxy", 44],
  ["tls", 35],
]) {
  const dir = mkdtempSync(join(root, `${failure}-`));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  mkdirSync(join(dir, "deploy"));
  writeFileSync(join(dir, ".env"), "APP_ORIGIN=https://credit.example.test\n");
  writeFileSync(join(dir, "current-image-tag"), `${previous}\n`);
  for (const name of ["Caddyfile", "proxy.yaml"])
    copyFileSync(`deploy/${name}`, join(dir, "deploy", name));
  writeFileSync(join(bin, "docker"), docker, { mode: 0o755 });
  writeFileSync(join(bin, "flock"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });
  writeFileSync(
    join(bin, "curl"),
    `#!/usr/bin/env bash
printf 'curl|%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
[[ "$DEPLOY_TEST_FAIL" != tls ]] || exit 35
`,
    { mode: 0o755 },
  );
  const log = join(dir, "commands.log");
  const result = spawnSync(
    bash,
    ["-c", 'export PATH="$DEPLOY_TEST_BIN:$PATH"; bash "$DEPLOY_TEST_SCRIPT"'],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        IMAGE_TAG: tag,
        IMAGE_BASE: "test/image",
        DEPLOY_APP_DIR: unix(dir),
        DEPLOY_TEST_BIN: unix(bin),
        DEPLOY_TEST_LOG: unix(log),
        DEPLOY_TEST_FAIL: failure,
        DEPLOY_TEST_PREVIOUS: previous,
        DEPLOY_TEST_SCRIPT: unix(resolve("deploy/deploy.sh")),
      },
    },
  );
  assert.equal(
    result.status,
    code,
    `${failure}: ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
  const commands = readFileSync(log, "utf8");
  const rollsBack = commands.includes(`${previous}|compose up -d --no-deps`);
  assert.equal(
    rollsBack,
    failure === "init" || failure === "app",
    `${failure}: rollback behavior`,
  );
  assert.equal(
    readFileSync(join(dir, "current-image-tag"), "utf8").trim(),
    failure === "init" || failure === "app" ? previous : tag,
    `${failure}: healthy image tracking`,
  );
  if (failure === "none" || failure === "tls") {
    assert.match(commands, /curl\|.*--retry-all-errors/);
    assert.match(commands, /curl\|.*--retry-max-time 180/);
    assert.doesNotMatch(commands, /--insecure/);
    assert.match(
      commands,
      /https:\/\/credit\.example\.test\/api\/health\/ready/,
    );
  }
  if (failure !== "none") assert.match(commands, /logs --tail=120 caddy/);
  console.log(`PASS deploy: ${failure}`);
}
