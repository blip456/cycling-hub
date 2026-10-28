#!/usr/bin/env node
// One command for a working local version: local Supabase (Docker) + .env.local + a local login.
//
//   pnpm local:setup            then   pnpm dev   → http://localhost:5173
//
// Local only. The values written to .env.local are the public defaults of the local Supabase stack;
// the local secret key is used once to create the user and is never written to disk.
// Optional: LOCAL_USER_EMAIL and LOCAL_USER_PASSWORD override the default local login.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EMAIL = process.env.LOCAL_USER_EMAIL ?? "rider@local.test";
const PASSWORD = process.env.LOCAL_USER_PASSWORD ?? "local-password-only";
const ENV_FILE = ".env.local";

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { stdio: "inherit", ...options });
}

function supabaseStatus() {
  try {
    const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Object.fromEntries(
      out
        .split("\n")
        .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    );
  } catch {
    return null;
  }
}

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// 1. Docker
if (run("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  fail("Docker is not running. Start Docker Desktop, OrbStack or Colima, then run this again.");
}

// 2. Local Supabase (start, then wait until the API answers; a database that was not shut down
//    cleanly can take a minute to recover).
console.log("→ Starting the local Supabase (first run downloads images, this can take a while)…");
run("pnpm", ["db:start"]);
let status = null;
for (let attempt = 0; attempt < 30; attempt += 1) {
  status = supabaseStatus();
  if (status?.API_URL && status.PUBLISHABLE_KEY) {
    const health = await fetch(`${status.API_URL}/auth/v1/health`, {
      headers: { apikey: status.PUBLISHABLE_KEY },
    }).catch(() => null);
    if (health?.ok) break;
  }
  await sleep(3000);
}
if (!status?.API_URL || !status.PUBLISHABLE_KEY || !status.SECRET_KEY) {
  fail("The local Supabase did not become ready. Check `pnpm exec supabase status`.");
}

// 3. .env.local (keep other lines the developer added)
const wanted = {
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
};
const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split("\n") : [];
const kept = lines.filter(
  (line) => line && !Object.keys(wanted).some((k) => line.startsWith(`${k}=`)),
);
writeFileSync(
  ENV_FILE,
  [...kept, ...Object.entries(wanted).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n",
);
console.log(`→ Wrote ${ENV_FILE} with the local Supabase URL and publishable key.`);

// 4. Local login (created once; an existing user is left as it is)
const response = await fetch(`${status.API_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: status.SECRET_KEY,
    Authorization: `Bearer ${status.SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
});
if (response.ok) {
  console.log(`→ Created the local user ${EMAIL}.`);
} else if (response.status === 422) {
  console.log(`→ The local user ${EMAIL} already exists.`);
} else {
  fail(`Could not create the local user (${response.status}): ${await response.text()}`);
}

console.log(`
✓ Local version ready.
  1. pnpm dev   → http://localhost:5173
  2. Sign in with ${EMAIL} / ${PASSWORD} (local only)
  3. Import your Strava export on the Import page.
  Emails (password reset) land in the local inbox: ${status.INBUCKET_URL ?? status.MAILPIT_URL ?? "see supabase status"}${status.STUDIO_URL ? `\n  Database studio: ${status.STUDIO_URL}` : ""}
`);
