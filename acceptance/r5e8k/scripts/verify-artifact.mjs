import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(packageRoot, "dist");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
};

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else result.push(path);
  }
  return result;
}

const html = await readFile(resolve(distRoot, "auth/callback/index.html"), "utf8");
const notFound = await readFile(resolve(distRoot, "404.html"), "utf8");
const evidence = JSON.parse(await readFile(resolve(distRoot, "artifact-evidence.json"), "utf8"));
const vercel = JSON.parse(await readFile(resolve(packageRoot, "vercel.json"), "utf8"));
const lock = await readFile(resolve(packageRoot, "package-lock.json"));
const browserSigningFixture = JSON.parse(await readFile(resolve(packageRoot, "tests/fixtures/browser-signing-key.json"), "utf8"));

if (sha256(html) !== evidence.artifactSha256) throw new Error("artifact digest mismatch");
if (sha256(lock) !== evidence.dependencyLockDigest) throw new Error("dependency lock digest mismatch");
if ((html.match(/<script>/gu) ?? []).length !== 1 || /<script[^>]+src=/iu.test(html)) throw new Error("script topology mismatch");
if ((html.match(/<style>/gu) ?? []).length !== 1 || /<link[^>]+stylesheet/iu.test(html)) throw new Error("style topology mismatch");
if (/<script/iu.test(notFound)) throw new Error("404 must be inert");
if (/sourceMappingURL/iu.test(html) || (await walk(distRoot)).some((path) => path.endsWith(".map"))) throw new Error("source map detected");
if (/<(?:img|audio|video|iframe|source)[^>]+src=["']https?:/iu.test(html)) throw new Error("remote asset detected");
if (/<link[^>]+href=["']https?:/iu.test(html)) throw new Error("remote link asset detected");
if ((await walk(distRoot)).length !== 3) throw new Error("unexpected generated artifact file topology");

const script = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
const style = html.match(/<style>([\s\S]*?)<\/style>/u)?.[1];
if (script === undefined || style === undefined) throw new Error("inline artifact extraction failed");
if (`sha256-${createHash("sha256").update(script).digest("base64")}` !== evidence.scriptCspHash) throw new Error("script digest mismatch");
if (`sha256-${createHash("sha256").update(style).digest("base64")}` !== evidence.styleCspHash) throw new Error("style digest mismatch");

const artifactCanaries = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "SYNTHETIC-PASSWORD-CANARY-8K",
  "SYNTHETIC-REFRESH-CANARY-8K",
  browserSigningFixture.privateJwk.d,
];
if (artifactCanaries.some((canary) => html.includes(canary) || notFound.includes(canary))) {
  throw new Error("secret canary entered generated artifact");
}

const forbiddenSecretPatterns = [
  /sb_secret_[A-Za-z0-9_-]{20,}/u,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/u,
  /SUPABASE_SERVICE_ROLE_KEY\s*=/u,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/u,
];
for (const path of await walk(packageRoot)) {
  if (path.includes("node_modules") || path.includes("test-results") || path.includes("playwright-report")) continue;
  const content = await readFile(path, "utf8").catch(() => "");
  if (forbiddenSecretPatterns.some((pattern) => pattern.test(content))) throw new Error(`negative secret scan failed: ${path}`);
}

const callbackRoute = vercel.routes?.[0];
const inertRoute = vercel.routes?.[1];
if (callbackRoute?.src !== "^/auth/callback$" || callbackRoute?.dest !== "/auth/callback/index.html") {
  throw new Error("callback route mismatch");
}
if (inertRoute?.src !== ".*" || inertRoute?.status !== 404 || inertRoute?.dest !== "/404.html") {
  throw new Error("inert route mismatch");
}
if (vercel.routes.length !== 2) throw new Error("unexpected executable route");
if (sha256(canonicalJson(callbackRoute.headers)) !== evidence.headerDigest) throw new Error("header digest mismatch");
if (!callbackRoute.headers["Content-Security-Policy"].includes(`script-src '${evidence.scriptCspHash}'`)) {
  throw new Error("script CSP mismatch");
}
if (!callbackRoute.headers["Content-Security-Policy"].includes(`style-src '${evidence.styleCspHash}'`)) {
  throw new Error("style CSP mismatch");
}
if (/unsafe-inline|unsafe-eval|https:\*|http:/iu.test(callbackRoute.headers["Content-Security-Policy"])) {
  throw new Error("CSP is broader than the acceptance contract");
}
if (callbackRoute.headers["Content-Security-Policy"].includes("report-uri")) throw new Error("CSP reporting is prohibited");
if (callbackRoute.headers["Referrer-Policy"] !== "no-referrer") throw new Error("referrer policy mismatch");
if (callbackRoute.headers["Cross-Origin-Opener-Policy"] !== "same-origin") throw new Error("opener isolation mismatch");

process.stdout.write(`${JSON.stringify({
  artifactSha256: evidence.artifactSha256,
  manifestCoreSha256: evidence.manifestCoreSha256,
  scriptCspHash: evidence.scriptCspHash,
  styleCspHash: evidence.styleCspHash,
  headerDigest: evidence.headerDigest,
  dependencyLockDigest: evidence.dependencyLockDigest,
  negativeSecretScan: "PASS",
  secretCanaryCount: 0,
  remoteAssetCount: 0,
  sourceMapCount: 0,
  executablePaths: ["/auth/callback"],
}, null, 2)}\n`);
