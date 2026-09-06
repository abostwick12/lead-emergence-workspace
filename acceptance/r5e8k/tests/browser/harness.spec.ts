import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = process.cwd();
const callbackUrl = "https://lead-emergence-entry-sso-preview-git-45c287-emergence-projects.vercel.app/auth/callback";
const authBaseUrl = "https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1";
const authCode = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const passwordCanary = "SYNTHETIC-PASSWORD-CANARY-8K";
const refreshCanary = "SYNTHETIC-REFRESH-CANARY-8K";

interface Artifact {
  html: string;
  manifest: Record<string, any>;
  privateKey: CryptoKey;
  securityHeaders: Record<string, string>;
  cleanup(): Promise<void>;
}

interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

async function createActiveArtifact(): Promise<Artifact> {
  const fixtureRoot = resolve(packageRoot, ".synthetic-build/browser");
  const core = JSON.parse(await readFile(resolve(packageRoot, "tests/fixtures/browser-manifest.json"), "utf8")) as Record<string, any>;
  const keys = JSON.parse(await readFile(resolve(packageRoot, "tests/fixtures/browser-signing-key.json"), "utf8")) as {
    privateJwk: JsonWebKey;
  };
  const privateKey = await webcrypto.subtle.importKey(
    "jwk",
    keys.privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const canonicalJson = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  };
  const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
  const manifest = {
    ...core,
    manifestCoreSha256: digest(canonicalJson(core)),
    publicKeySha256: digest(core.publicKey),
    fixtureBindingSha256: digest(canonicalJson(core.fixture)),
  };
  const evidence = JSON.parse(await readFile(resolve(fixtureRoot, "dist/artifact-evidence.json"), "utf8")) as {
    scriptCspHash: string;
    styleCspHash: string;
  };
  const securityHeaders = {
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src '${evidence.scriptCspHash}'`,
      "script-src-attr 'none'",
      `style-src '${evidence.styleCspHash}'`,
      "style-src-attr 'none'",
      `connect-src ${new URL(authBaseUrl).origin}`,
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
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  return {
    html: await readFile(resolve(fixtureRoot, "dist/auth/callback/index.html"), "utf8"),
    manifest,
    privateKey,
    securityHeaders,
    cleanup: async () => undefined,
  };
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function recoveryToken(artifact: Artifact): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "ES256", kid: artifact.manifest.jwt.kid, typ: "JWT" });
  const claims = encode({
    iss: artifact.manifest.jwt.issuer,
    aud: artifact.manifest.jwt.audience,
    role: artifact.manifest.jwt.role,
    sub: artifact.manifest.fixture.subject,
    email: artifact.manifest.fixture.currentEmail,
    session_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    aal: "aal1",
    amr: [{ method: "recovery", timestamp: now }],
    iat: now,
    exp: now + 3600,
  });
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    artifact.privateKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${Buffer.from(signature).toString("base64url")}`;
}

async function installSyntheticNetwork(
  context: BrowserContext,
  artifact: Artifact,
  captured: CapturedRequest[],
  behavior: { abortOperation?: "recover" | "token" | "email" | "password" } = {},
): Promise<void> {
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(callbackUrl).origin && url.pathname === "/auth/callback") {
      await route.fulfill({ status: 200, headers: { ...artifact.securityHeaders, "Content-Type": "text/html; charset=utf-8" }, body: artifact.html });
      return;
    }
    if (url.origin === "https://mailbox.example.invalid") {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Synthetic mailbox</title>" });
      return;
    }
    if (request.method() === "OPTIONS" && request.url().startsWith(authBaseUrl)) {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": new URL(callbackUrl).origin,
          "Access-Control-Allow-Headers": "apikey,authorization,content-type",
          "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
          "Access-Control-Max-Age": "0",
        },
      });
      return;
    }
    if (request.url().startsWith(authBaseUrl)) {
      const body = request.postData();
      captured.push({ method: request.method(), url: request.url(), headers: request.headers(), body });
      const isRecover = url.pathname.endsWith("/recover");
      const isToken = url.pathname.endsWith("/token");
      const parsedBody = body === null ? {} : (JSON.parse(body) as Record<string, unknown>);
      const isEmail = url.pathname.endsWith("/user") && Object.hasOwn(parsedBody, "email");
      const isPassword = url.pathname.endsWith("/user") && Object.hasOwn(parsedBody, "password");
      if (
        behavior.abortOperation === (isRecover ? "recover" : isToken ? "token" : isEmail ? "email" : isPassword ? "password" : undefined)
      ) {
        await route.abort("connectionreset");
        return;
      }
      const cors = { "Access-Control-Allow-Origin": new URL(callbackUrl).origin, "Content-Type": "application/json" };
      if (isRecover) await route.fulfill({ status: 200, headers: cors, body: "{}" });
      else if (isToken) {
        const token = await recoveryToken(artifact);
        const now = Math.floor(Date.now() / 1000);
        await route.fulfill({
          status: 200,
          headers: cors,
          body: JSON.stringify({
            access_token: token,
            refresh_token: refreshCanary,
            token_type: "bearer",
            expires_in: 3600,
            expires_at: now + 3600,
            user: { id: artifact.manifest.fixture.subject },
          }),
        });
      } else if (isEmail) {
        await route.fulfill({
          status: 200,
          headers: cors,
          body: JSON.stringify({
            id: artifact.manifest.fixture.subject,
            email: artifact.manifest.fixture.currentEmail,
            new_email: artifact.manifest.fixture.newEmail,
          }),
        });
      } else if (isPassword) {
        await route.fulfill({
          status: 200,
          headers: cors,
          body: JSON.stringify({ id: artifact.manifest.fixture.subject, email: artifact.manifest.fixture.currentEmail }),
        });
      } else await route.abort("blockedbyclient");
      return;
    }
    await route.abort("blockedbyclient");
  });
}

async function reachRecoveryEvidence(page: Page, artifact: Artifact): Promise<void> {
  await page.goto(callbackUrl);
  await page.locator("#send-recovery").click();
  await expect(page.locator("#status")).toContainText("recovery requested");
  await page.goto("https://mailbox.example.invalid/");
  await page.goto(`${callbackUrl}?code=${authCode}`);
  await expect(page.locator("#status")).toHaveText("Return only: C-PKCE-RECOVERY COMPLETE");
}

test("complete ceremony uses one original token and leaves no browser secret", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  const consoleMessages: string[] = [];
  try {
    page.on("console", (message) => consoleMessages.push(message.text()));
    await installSyntheticNetwork(context, artifact, captured);
    await reachRecoveryEvidence(page, artifact);
    await page.locator("#recovery-evidence").click();
    await page.locator("#request-email-change").click();
    await expect(page.locator("#status")).toHaveText("Return only: C-EMAIL-CHANGE REQUESTED");
    await page.locator("#pending-evidence").click();
    await page.locator("#new-password").fill(passwordCanary);
    await page.locator("#update-password").click();
    await expect(page.locator("#status")).toHaveText("Return only: C-PASSWORD COMPLETE");

    expect(captured).toHaveLength(4);
    expect(captured.map((entry) => entry.method)).toEqual(["POST", "POST", "PUT", "PUT"]);
    expect(captured[0]!.url).toContain("/recover?redirect_to=");
    expect(captured[1]!.url).toBe(`${authBaseUrl}/token?grant_type=pkce`);
    expect(captured[2]!.url).toContain(`/user?redirect_to=${encodeURIComponent(callbackUrl)}`);
    expect(captured[3]!.url).toBe(`${authBaseUrl}/user`);
    expect(captured[2]!.headers.authorization).toBe(captured[3]!.headers.authorization);

    const browserEvidence = await page.evaluate(() => ({
      url: location.href,
      text: document.body.textContent ?? "",
      dom: document.documentElement.outerHTML,
      password: (document.querySelector("#new-password") as HTMLInputElement).value,
      storage: Object.values(sessionStorage),
      localStorageCount: localStorage.length,
      cookie: document.cookie,
      controls: [...document.querySelectorAll("button:not([hidden]):not([disabled]),input:not([hidden]):not([disabled])")].length,
    }));
    const originalAccessToken = captured[2]!.headers.authorization!.slice("Bearer ".length);
    expect(browserEvidence.url).toBe(callbackUrl);
    expect(browserEvidence.password).toBe("");
    expect(browserEvidence.controls).toBe(0);
    expect(JSON.stringify(browserEvidence)).not.toContain(authCode);
    expect(JSON.stringify(browserEvidence)).not.toContain(passwordCanary);
    expect(JSON.stringify(browserEvidence)).not.toContain(refreshCanary);
    expect(JSON.stringify(browserEvidence)).not.toContain(originalAccessToken);
    expect(browserEvidence.storage).toHaveLength(1);
    expect(browserEvidence.storage[0]).toContain('"terminalReason":"COMPLETE"');
    expect(browserEvidence.localStorageCount).toBe(0);
    expect(browserEvidence.cookie).toBe("");
    expect(await context.cookies()).toHaveLength(0);
    expect(consoleMessages).toHaveLength(0);
  } finally {
    await artifact.cleanup();
  }
});

test("reload, back, and duplicate callback after exchange remain terminal", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  try {
    await installSyntheticNetwork(context, artifact, captured);
    await reachRecoveryEvidence(page, artifact);
    expect(captured).toHaveLength(2);
    await page.goto("https://mailbox.example.invalid/");
    await page.goBack();
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP — EXCHANGE_COMMITTED");
    await page.reload();
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP — EXCHANGE_COMMITTED");
    await page.goto(`${callbackUrl}?code=${authCode}`);
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP");
    expect(captured).toHaveLength(2);
  } finally {
    await artifact.cleanup();
  }
});

test("lost recovery response is terminal and never retries", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  try {
    await installSyntheticNetwork(context, artifact, captured, { abortOperation: "recover" });
    await page.goto(callbackUrl);
    await page.locator("#send-recovery").click();
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP — RECOVERY_REQUEST_UNCERTAIN");
    await page.reload();
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP");
    expect(captured).toHaveLength(1);
  } finally {
    await artifact.cleanup();
  }
});

test("opener and concurrent top-level contexts fail closed before Auth", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  try {
    await installSyntheticNetwork(context, artifact, captured);
    await page.goto(callbackUrl);
    const popupPromise = page.waitForEvent("popup");
    await page.evaluate(() => window.open(location.href, "_blank"));
    const popup = await popupPromise;
    await expect(popup.locator("#status")).toContainText("C-HARNESS STOP");

    const second = await context.newPage();
    await second.goto(callbackUrl);
    await expect(second.locator("#status")).toContainText("C-HARNESS STOP — DUPLICATE_CONTEXT");
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP — DUPLICATE_CONTEXT");
    expect(captured).toHaveLength(0);
  } finally {
    await artifact.cleanup();
  }
});

test("expired continuation cannot be consumed after mailbox navigation", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  try {
    await installSyntheticNetwork(context, artifact, captured);
    await page.goto(callbackUrl);
    await page.locator("#send-recovery").click();
    await expect(page.locator("#status")).toContainText("recovery requested");
    await page.evaluate(() => {
      const key = Object.keys(sessionStorage)[0]!;
      const record = JSON.parse(sessionStorage.getItem(key)!) as { createdAtEpochMs: number; absoluteExpiryEpochMs: number };
      record.createdAtEpochMs = Date.now() - 240001;
      record.absoluteExpiryEpochMs = record.createdAtEpochMs + 240000;
      sessionStorage.setItem(key, JSON.stringify(record));
    });
    await page.goto("https://mailbox.example.invalid/");
    await page.goto(`${callbackUrl}?code=${authCode}`);
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP");
    expect(captured).toHaveLength(1);
  } finally {
    await artifact.cleanup();
  }
});

for (const operation of ["token", "email", "password"] as const) {
  test(`lost ${operation} response is terminal and never retries`, async ({ context, page }) => {
    const artifact = await createActiveArtifact();
    const captured: CapturedRequest[] = [];
    try {
      await installSyntheticNetwork(context, artifact, captured, { abortOperation: operation });
      if (operation === "token") {
        await page.goto(callbackUrl);
        await page.locator("#send-recovery").click();
        await expect(page.locator("#status")).toContainText("recovery requested");
        await page.goto("https://mailbox.example.invalid/");
        await page.goto(`${callbackUrl}?code=${authCode}`);
        await expect(page.locator("#status")).toContainText("C-HARNESS STOP — EXCHANGE_UNCERTAIN");
        expect(captured).toHaveLength(2);
      } else {
        await reachRecoveryEvidence(page, artifact);
        await page.locator("#recovery-evidence").click();
        await page.locator("#request-email-change").click();
        if (operation === "email") {
          await expect(page.locator("#status")).toContainText("C-HARNESS STOP — MUTATION_UNCERTAIN");
          expect(captured).toHaveLength(3);
        } else {
          await expect(page.locator("#status")).toHaveText("Return only: C-EMAIL-CHANGE REQUESTED");
          await page.locator("#pending-evidence").click();
          await page.locator("#new-password").fill(passwordCanary);
          await page.locator("#update-password").click();
          await expect(page.locator("#status")).toContainText("C-HARNESS STOP — MUTATION_UNCERTAIN");
          expect(captured).toHaveLength(4);
        }
      }
      const attempts = captured.length;
      await page.reload();
      await expect(page.locator("#status")).toContainText("C-HARNESS STOP");
      expect(captured).toHaveLength(attempts);
      expect(await page.locator("button:not([hidden]):not([disabled]),input:not([hidden]):not([disabled])").count()).toBe(0);
    } finally {
      await artifact.cleanup();
    }
  });
}

test("post-exchange action deadline makes every control terminal", async ({ context, page }) => {
  const artifact = await createActiveArtifact();
  const captured: CapturedRequest[] = [];
  try {
    await page.clock.install({ time: new Date() });
    await installSyntheticNetwork(context, artifact, captured);
    await reachRecoveryEvidence(page, artifact);
    await page.clock.fastForward(1_800_001);
    await expect(page.locator("#status")).toContainText("C-HARNESS STOP — EXPIRED");
    expect(await page.locator("button:not([hidden]):not([disabled]),input:not([hidden]):not([disabled])").count()).toBe(0);
    expect(captured).toHaveLength(2);
  } finally {
    await artifact.cleanup();
  }
});
