import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd();
const enableReload = process.env.CAREERAI_BACKEND_RELOAD === "true";
const backendHost = process.env.CAREERAI_BACKEND_HOST || "127.0.0.1";
const backendPort = process.env.CAREERAI_BACKEND_PORT || "8012";
const healthUrl = `http://${backendHost}:${backendPort}/api/health`;
const backendFiles = [
  "backend/app/main.py",
  "backend/app/services.py",
  "backend/app/database.py",
];
const backendBuild = createHash("sha1")
  .update(backendFiles.map((file) => readFileSync(path.join(cwd, file))).join("\n"))
  .digest("hex")
  .slice(0, 12);
const bundledPython = path.join(
  process.env.USERPROFILE || "C:\\Users\\PMLS",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);

const candidates = [
  process.env.CAREERAI_PYTHON,
  process.env.PYTHON,
  existsSync(bundledPython) ? bundledPython : null,
  "python",
  "py",
].filter(Boolean);

function isUsablePython(candidate) {
  const probe = spawnSync(
    candidate,
    [
      "-c",
      "import certifi, docx, dotenv, fastapi, pymongo, pypdf, uvicorn",
    ],
    {
      cwd,
      encoding: "utf8",
      shell: false,
      timeout: 10000,
      windowsHide: true,
    },
  );
  return !probe.error && probe.status === 0;
}

const python = candidates.find(isUsablePython);

if (!python) {
  console.error(
    "CareerAI could not find a Python runtime with the backend dependencies installed. " +
      "Install backend/requirements.txt or set CAREERAI_PYTHON to a compatible python.exe.",
  );
  process.exit(1);
}

async function hasHealthyBackend() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.status === "ok" ? payload : null;
  } catch {
    return null;
  }
}

function stopStaleWindowsBackend() {
  if (process.platform !== "win32") return false;
  const netstat = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], { encoding: "utf8", windowsHide: true });
  const listener = netstat.stdout
    ?.split(/\r?\n/)
    .find((line) => line.includes(`:${backendPort}`) && line.includes("LISTENING"));
  const pid = listener?.trim().split(/\s+/).at(-1);
  if (!pid || !/^\d+$/.test(pid)) return false;
  const stopped = spawnSync("taskkill.exe", ["/PID", pid, "/T", "/F"], { encoding: "utf8", windowsHide: true });
  return stopped.status === 0;
}

const currentBackend = await hasHealthyBackend();
if (currentBackend && currentBackend.backendBuild !== backendBuild) {
  console.log(`[backend] Replacing outdated CareerAI API on port ${backendPort}.`);
  if (!stopStaleWindowsBackend()) {
    console.error(`[backend] Stop the existing API on port ${backendPort}, then run this command again.`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

if (currentBackend?.backendBuild === backendBuild) {
  console.log(`[backend] CareerAI API is already healthy at ${healthUrl}. Reusing it.`);

  const monitor = setInterval(async () => {
    const health = await hasHealthyBackend();
    if (!health || health.backendBuild !== backendBuild) {
      console.error(`[backend] The reused CareerAI API at ${healthUrl} stopped responding.`);
      process.exit(1);
    }
  }, 3000);

  const stopMonitor = () => {
    clearInterval(monitor);
    process.exit(0);
  };
  process.once("SIGINT", stopMonitor);
  process.once("SIGTERM", stopMonitor);
} else {
  const args = ["-m", "uvicorn", "backend.app.main:app", "--host", backendHost, "--port", backendPort];
  if (enableReload) {
    args.push("--reload");
  }

  console.log(`[backend] Using Python: ${python}`);

  const child = spawn(python, args, {
    cwd,
    env: { ...process.env, CAREERAI_BACKEND_BUILD: backendBuild },
    stdio: "inherit",
    shell: false,
  });

  let shuttingDown = false;
  const stopChild = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once("SIGINT", () => stopChild("SIGINT"));
  process.once("SIGTERM", () => stopChild("SIGTERM"));
  process.once("SIGHUP", () => stopChild("SIGHUP"));

  child.on("error", (error) => {
    console.error(`[backend] Failed to start Python: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown || signal) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}
