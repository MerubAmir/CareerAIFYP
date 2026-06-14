import "dotenv/config";

const checks = [];

function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

const apiBase = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8012/api";

check("MongoDB URI", Boolean(process.env.MONGODB_URI?.trim()), "MONGODB_URI must be configured.");
check(
  "Real MongoDB mode",
  process.env.MONGODB_USE_MOCK?.toLowerCase() === "false",
  "MONGODB_USE_MOCK must be false for the demo.",
);
check(
  "Frontend API URL",
  apiBase === "http://127.0.0.1:8012/api",
  `Expected http://127.0.0.1:8012/api, found ${apiBase}.`,
);
check(
  "Gemini chatbot",
  Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim()),
  "Add GEMINI_API_KEY for open-domain chatbot answers.",
);
check(
  "GitHub integration",
  Boolean(process.env.GITHUB_TOKEN?.trim()),
  "Add GITHUB_TOKEN to avoid anonymous API rate limits.",
);

try {
  let response;
  let health;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      response = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        health = await response.json();
        break;
      }
    } catch {
      // Atlas-backed startup can take a few seconds.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check("Backend health", Boolean(response?.ok && health?.status === "ok"), "Start the backend with npm run backend.");
  check("Atlas connection", health?.database === "mongodb", `Backend reported ${health?.database || "no database"}.`);
  check("Backend AI status", health?.llmConfigured === true, "Backend does not detect an AI provider key.");
} catch {
  check("Backend health", false, "Backend is not reachable. Run npm run backend first.");
}

for (const item of checks) {
  console.log(`${item.passed ? "PASS" : "FAIL"}  ${item.name}${item.passed ? "" : `: ${item.detail}`}`);
}

const failed = checks.filter((item) => !item.passed);
if (failed.length) {
  console.error(`\nDemo preflight failed: ${failed.length} check(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log("\nDemo preflight passed.");
}
