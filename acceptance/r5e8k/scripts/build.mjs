import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(packageRoot, "dist");

function assertInsidePackage(path, label) {
  const relation = relative(packageRoot, path);
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error(`${label} must remain inside the package`);
  }
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value, encoding = "hex") {
  return createHash("sha256").update(value).digest(encoding);
}

function parseArguments(argv) {
  const result = { manifest: resolve(packageRoot, "run-manifest.example.json"), outDir: distRoot };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--manifest") result.manifest = resolve(packageRoot, argv[++index]);
    else if (argv[index] === "--out-dir") result.outDir = resolve(packageRoot, argv[++index]);
    else throw new Error(`unknown build argument: ${argv[index]}`);
  }
  assertInsidePackage(result.outDir, "output directory");
  return result;
}

function rejectPrivilegedManifest(core) {
  const key = String(core.publicKey ?? "");
  if (key.startsWith("sb_secret_") || /service[_-]?role/iu.test(key)) throw new Error("privileged key rejected");
  if (key.includes(".")) {
    const segments = key.split(".");
    if (segments.length !== 3) throw new Error("malformed public key rejected");
    let payload;
    try {
      payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    } catch {
      throw new Error("malformed public key rejected");
    }
    if (payload.role !== "anon") throw new Error("privileged key rejected");
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("unrecognized public key rejected");
  }
  if (core.projectRef !== "vnjdubrnmxvmsccxmhst") throw new Error("project ref rejected");
  if (core.callbackUrl !== "https://lead-emergence-entry-sso-preview-git-45c287-emergence-projects.vercel.app/auth/callback") {
    throw new Error("callback rejected");
  }
  if (core.jwt?.jwk?.d !== undefined || core.jwt?.jwk?.k !== undefined) throw new Error("private JWT verification material rejected");
}

export async function buildArtifact(options = {}) {
  const manifestPath = resolve(options.manifestPath ?? resolve(packageRoot, "run-manifest.example.json"));
  const outputRoot = resolve(options.outputRoot ?? distRoot);
  assertInsidePackage(outputRoot, "output directory");
  const core = JSON.parse(await readFile(manifestPath, "utf8"));
  rejectPrivilegedManifest(core);
  const manifest = {
    ...core,
    manifestCoreSha256: sha256(canonicalJson(core)),
    publicKeySha256: sha256(core.publicKey),
    fixtureBindingSha256: sha256(canonicalJson(core.fixture)),
  };

  const bundle = await build({
    absWorkingDir: packageRoot,
    entryPoints: { harness: resolve(packageRoot, "src/harness.ts") },
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    sourcemap: false,
    legalComments: "none",
    write: false,
    define: { __R5E8K_MANIFEST__: canonicalJson(manifest) },
  });
  const script = bundle.outputFiles[0].text.trim();
  const style = (await readFile(resolve(packageRoot, "src/styles.css"), "utf8")).trim();
  const scriptCspHash = `sha256-${sha256(script, "base64")}`;
  const styleCspHash = `sha256-${sha256(style, "base64")}`;
  const csp = [
    "default-src 'none'",
    `script-src '${scriptCspHash}'`,
    "script-src-attr 'none'",
    `style-src '${styleCspHash}'`,
    "style-src-attr 'none'",
    "connect-src https://vnjdubrnmxvmsccxmhst.supabase.co",
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "worker-src 'none'",
    "child-src 'none'",
    "frame-src 'none'",
    "manifest-src 'none'",
    "media-src 'none'",
    "font-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
  ].join("; ");
  const securityHeaders = {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Content-Security-Policy": csp,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
    "Permissions-Policy": "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), publickey-credentials-create=(), publickey-credentials-get=(), usb=()",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  const inertHeaders = { ...securityHeaders, "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };

  const template = await readFile(resolve(packageRoot, "src/index.template.html"), "utf8");
  const html = template
    .replace("__R5E8K_STYLE__", style)
    .replace("__R5E8K_RUN_ID__", manifest.runId)
    .replace("__R5E8K_SCRIPT__", script);
  const notFound = "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><title>Not Found</title><p>Not Found</p></html>\n";

  const vercelTemplate = await readFile(resolve(packageRoot, "vercel.template.json"), "utf8");
  const vercelConfig = vercelTemplate
    .replace('"__SECURITY_HEADERS__"', canonicalJson(securityHeaders))
    .replace('"__INERT_HEADERS__"', canonicalJson(inertHeaders));
  JSON.parse(vercelConfig);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(resolve(outputRoot, "auth/callback"), { recursive: true });
  await writeFile(resolve(outputRoot, "auth/callback/index.html"), html, "utf8");
  await writeFile(resolve(outputRoot, "404.html"), notFound, "utf8");
  if (outputRoot === distRoot) await writeFile(resolve(packageRoot, "vercel.json"), `${vercelConfig.trim()}\n`, "utf8");

  const lockBytes = await readFile(resolve(packageRoot, "package-lock.json"));
  const evidence = {
    schema: "r5e8k-artifact-evidence/v1",
    syntheticOnly: manifest.syntheticOnly,
    artifactSha256: sha256(html),
    manifestCoreSha256: manifest.manifestCoreSha256,
    scriptCspHash,
    styleCspHash,
    headerDigest: sha256(canonicalJson(securityHeaders)),
    dependencyLockDigest: sha256(lockBytes),
    generatedFiles: ["auth/callback/index.html", "404.html"],
    sourceMapCount: 0,
  };
  await writeFile(resolve(outputRoot, "artifact-evidence.json"), `${canonicalJson(evidence)}\n`, "utf8");
  return { evidence, html, script, style, securityHeaders, manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArguments(process.argv.slice(2));
  const result = await buildArtifact({ manifestPath: args.manifest, outputRoot: args.outDir });
  if (process.argv.length === 2) {
    await buildArtifact({
      manifestPath: resolve(packageRoot, "tests/fixtures/browser-manifest.json"),
      outputRoot: resolve(packageRoot, ".synthetic-build/browser/dist"),
    });
  }
  process.stdout.write(`${JSON.stringify(result.evidence, null, 2)}\n`);
}
