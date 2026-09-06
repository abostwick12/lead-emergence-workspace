import { createHmac, randomBytes, randomUUID, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imagePin = JSON.parse(readFileSync(resolve(packageRoot, "gotrue-image.json"), "utf8"));
const GOTRUE_TAG = imagePin.tag;
const GOTRUE_MANIFEST_DIGEST = imagePin.manifestListDigest;
const GOTRUE_AMD64_DIGEST = imagePin.platformDigest;
const GOTRUE_IMAGE = `supabase/gotrue@${GOTRUE_AMD64_DIGEST}`;
const POSTGRES_IMAGE = imagePin.postgresImage;
const CALLBACK_PATH = "/auth/callback";
const TEST_TIMEOUT_MS = 120_000;
const POSTGRES_INIT_COMPLETE_MARKER = "PostgreSQL init process complete; ready for start up.";
const diagnosticSecrets = new Set();

function fail(message) {
  throw new Error(message);
}

function registerDiagnosticSecrets(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) diagnosticSecrets.add(value);
  }
}

function sanitizeDiagnostic(value) {
  let sanitized = String(value);
  for (const secret of diagnosticSecrets) sanitized = sanitized.replaceAll(secret, "[REDACTED]");
  return sanitized
    .replace(/postgres:\/\/([^:\s/]+):[^@\s/]+@/giu, "postgres://$1:[REDACTED]@")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[REDACTED_JWT]")
    .replace(/https?:\/\/[^\s<>"']+/giu, "[REDACTED_URL]")
    .replace(/("d"\s*:\s*")[^"]+("?)/giu, "$1[REDACTED]$2");
}

function emitDiagnostic(label, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  process.stderr.write(`R5E8K_STARTUP_DIAGNOSTIC ${label} ${sanitizeDiagnostic(serialized)}\n`);
}

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: options.timeout ?? TEST_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      `container command failed (${args[0]} ${args[1] ?? ""}); status=${result.status}; stderr=${sanitizeDiagnostic(result.stderr.trim())}`,
    );
  }
  return { status: result.status ?? 1, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function containerRuntimeState(name) {
  const result = docker([
    "inspect",
    "--format",
    '{"status":{{json .State.Status}},"running":{{json .State.Running}},"exitCode":{{json .State.ExitCode}},"restartCount":{{json .RestartCount}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"none"{{end}}}',
    name,
  ], { allowFailure: true });
  if (result.status !== 0) return { status: "inspect-unavailable", running: false, exitCode: null, restartCount: null, health: "unknown" };
  return JSON.parse(result.stdout);
}

function containerDiagnostic(name) {
  const result = docker(["inspect", name], { allowFailure: true });
  if (result.status !== 0) {
    return { name, inspect: "unavailable", error: sanitizeDiagnostic(result.stderr) };
  }
  const [details] = JSON.parse(result.stdout);
  const networks = Object.fromEntries(
    Object.entries(details.NetworkSettings?.Networks ?? {}).map(([networkName, network]) => [
      networkName,
      {
        endpointId: network.EndpointID,
        ipAddress: network.IPAddress,
        ipPrefixLength: network.IPPrefixLen,
        gateway: network.Gateway,
        aliases: network.Aliases,
      },
    ]),
  );
  return {
    id: details.Id,
    name: details.Name,
    image: details.Config?.Image,
    state: {
      status: details.State?.Status,
      running: details.State?.Running,
      exitCode: details.State?.ExitCode,
      error: details.State?.Error,
      startedAt: details.State?.StartedAt,
      finishedAt: details.State?.FinishedAt,
      health: details.State?.Health?.Status ?? "none",
    },
    restartCount: details.RestartCount,
    ports: details.NetworkSettings?.Ports,
    networks,
    extraHosts: details.HostConfig?.ExtraHosts,
  };
}

function containerLogs(name) {
  const result = docker(["logs", "--timestamps", "--tail", "200", name], { allowFailure: true });
  return [result.stdout, result.stderr].filter(Boolean).join("\n") || "(no container log output)";
}

function smtpTransportProbe(container, hostname, port) {
  const resolution = docker(
    ["exec", container, "/bin/sh", "-c", `awk '$2 == "${hostname}" { print $1 }' /etc/hosts`],
    { allowFailure: true },
  );
  const resolvedAddresses = resolution.status === 0
    ? resolution.stdout.split(/\s+/u).filter(Boolean)
    : [];
  const tcp = docker(
    ["exec", container, "/bin/sh", "-c", `nc -z -w 3 ${hostname} ${port}`],
    { allowFailure: true },
  );
  return {
    hostname,
    port,
    resolution: {
      status: resolution.status === 0 && resolvedAddresses.length > 0 ? "resolved" : "unresolved",
      addresses: resolvedAddresses,
      diagnostic: resolution.status === 0 ? "(none)" : sanitizeDiagnostic(resolution.stderr).slice(0, 512),
    },
    tcp: {
      status: tcp.status === 0 ? "reachable" : "unreachable",
      diagnostic: tcp.status === 0 ? "(none)" : sanitizeDiagnostic(tcp.stderr).slice(0, 512),
    },
  };
}

function recoveryErrorId(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/"error_id":"([0-9a-f-]{36})"/iu)?.[1] ?? "unavailable";
}

function recoveryFailureDiagnostics({ error, auth, smtp, network, smtpHost, smtpPort, transportProbe }) {
  const errorId = recoveryErrorId(error);
  const matchingLogs = containerLogs(auth)
    .split(/\r?\n/gu)
    .filter((line) => errorId === "unavailable" || line.includes(errorId));
  return {
    errorId,
    smtp: {
      hostname: smtpHost,
      port: smtpPort,
      listener: smtp.status(),
      transportProbe,
    },
    gotrue: containerDiagnostic(auth),
    network: networkDiagnostic(network),
    gotrueLogsForErrorId: matchingLogs.join("\n") || "(no matching GoTrue log lines)",
  };
}

function networkDiagnostic(name) {
  const result = docker([
    "network",
    "inspect",
    "--format",
    '{"id":{{json .Id}},"name":{{json .Name}},"driver":{{json .Driver}},"scope":{{json .Scope}},"internal":{{json .Internal}},"containers":{{json .Containers}}}',
    name,
  ], { allowFailure: true });
  return result.status === 0 ? JSON.parse(result.stdout) : { name, inspect: "unavailable" };
}

function emitStartupDiagnostics({ network, database, auth, smtp }) {
  const containers = docker(["ps", "-a", "--filter", "name=r5e8k-", "--format", "{{json .}}"], { allowFailure: true });
  emitDiagnostic("docker-ps-a", containers.stdout || "(no matching containers)");
  emitDiagnostic("postgres-inspect", containerDiagnostic(database));
  emitDiagnostic("gotrue-inspect", containerDiagnostic(auth));
  emitDiagnostic("smtp-status", smtp.status());
  emitDiagnostic("network-inspect", networkDiagnostic(network));
  emitDiagnostic("postgres-logs", containerLogs(database));
  emitDiagnostic("gotrue-logs", containerLogs(auth));
}

function requireDocker() {
  const version = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (version.error?.code === "ENOENT") {
    throw new Error("LOCAL_BACKEND_UNAVAILABLE: Docker executable not found");
  }
  if (version.status !== 0 || !version.stdout.trim()) {
    throw new Error("LOCAL_BACKEND_UNAVAILABLE: Docker daemon is not available");
  }
  return version.stdout.trim();
}

function base64url(value) {
  const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return bytes.toString("base64url");
}

function signLegacyJwt(secret, claims) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function signEs256Jwt(privateKey, kid, claims) {
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid }));
  const payload = base64url(JSON.stringify(claims));
  const signed = Buffer.from(`${header}.${payload}`);
  const signature = Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, signed));
  return `${header}.${payload}.${base64url(signature)}`;
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) fail("backend returned malformed JWT");
  return {
    header: JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    claims: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
    signature: Buffer.from(parts[2], "base64url"),
    signed: Buffer.from(`${parts[0]}.${parts[1]}`),
  };
}

async function assertRecoveryJwt(token, publicJwk, expected) {
  const parsed = decodeJwt(token);
  if (parsed.header.alg !== "ES256" || parsed.header.kid !== publicJwk.kid) fail("backend JWT signing key mismatch");
  const key = await webcrypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    parsed.signature,
    parsed.signed,
  );
  if (!valid) fail("backend recovery JWT signature rejected");
  const claims = parsed.claims;
  const amrKeys = Array.isArray(claims.amr) && claims.amr.length === 1 ? Object.keys(claims.amr[0]).sort() : [];
  if (
    claims.iss !== expected.issuer ||
    claims.aud !== "authenticated" ||
    claims.role !== "authenticated" ||
    claims.sub !== expected.subject ||
    claims.email !== expected.email ||
    claims.aal !== "aal1" ||
    typeof claims.session_id !== "string" ||
    amrKeys.join(",") !== "method,timestamp" ||
    claims.amr[0].method !== "recovery" ||
    !Number.isInteger(claims.amr[0].timestamp)
  ) {
    fail("backend recovery JWT claim contract mismatch");
  }
  return { sessionId: claims.session_id, claims };
}

async function assertFixtureAdminJwt(token, publicJwk, now) {
  const parsed = decodeJwt(token);
  if (
    parsed.header.alg !== "ES256" ||
    parsed.header.kid !== publicJwk.kid ||
    parsed.claims.iss !== "supabase" ||
    parsed.claims.aud !== "authenticated" ||
    parsed.claims.role !== "service_role" ||
    parsed.claims.iat !== now ||
    !Number.isInteger(parsed.claims.exp) ||
    parsed.claims.exp <= parsed.claims.iat ||
    parsed.claims.exp - parsed.claims.iat > 3600 ||
    "session_id" in parsed.claims ||
    "sub" in parsed.claims ||
    "email" in parsed.claims
  ) {
    fail("synthetic fixture-admin JWT claim contract mismatch");
  }
  const key = await webcrypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    parsed.signature,
    parsed.signed,
  );
  if (!valid) fail("synthetic fixture-admin JWT signature rejected");
}

function assertPasswordJwt(token, expectedSubject) {
  const { claims } = decodeJwt(token);
  if (
    claims.sub !== expectedSubject ||
    !Array.isArray(claims.amr) ||
    claims.amr.length !== 1 ||
    claims.amr[0].method !== "password"
  ) {
    fail("ordinary password session AMR contract mismatch");
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") return reject(new Error("unable to reserve port"));
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startSmtpCapture() {
  const messages = [];
  const sockets = new Set();
  let acceptedConnections = 0;
  const server = createServer((socket) => {
    acceptedConnections += 1;
    sockets.add(socket);
    let buffer = "";
    let dataMode = false;
    let dataLines = [];
    let authLoginStep = 0;
    socket.setEncoding("utf8");
    socket.write("220 r5e8k.synthetic ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const boundary = buffer.indexOf("\r\n");
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (dataMode) {
          if (line === ".") {
            messages.push(dataLines.join("\r\n"));
            dataLines = [];
            dataMode = false;
            socket.write("250 2.0.0 accepted\r\n");
          } else {
            dataLines.push(line.startsWith("..") ? line.slice(1) : line);
          }
          continue;
        }
        if (authLoginStep > 0) {
          if (authLoginStep === 1) {
            authLoginStep = 2;
            socket.write("334 UGFzc3dvcmQ6\r\n");
          } else {
            authLoginStep = 0;
            socket.write("235 2.7.0 authenticated\r\n");
          }
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith("EHLO") || command.startsWith("HELO")) {
          socket.write("250-r5e8k.synthetic\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (command.startsWith("AUTH PLAIN")) {
          socket.write("235 2.7.0 authenticated\r\n");
        } else if (command === "AUTH LOGIN") {
          authLoginStep = 1;
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else if (command === "DATA") {
          dataMode = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "QUIT") {
          socket.end("221 2.0.0 bye\r\n");
        } else {
          socket.write("250 2.0.0 ok\r\n");
        }
      }
    });
    socket.on("close", () => sockets.delete(socket));
  });
  return {
    messages,
    status() {
      const address = server.address();
      return {
        listening: server.listening,
        bindAddress: address && typeof address !== "string" ? address.address : null,
        port: address && typeof address !== "string" ? address.port : null,
        acceptedConnections,
        activeConnections: sockets.size,
        capturedMessages: messages.length,
      };
    },
    async listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "0.0.0.0", () => {
          const address = server.address();
          if (address === null || typeof address === "string") return reject(new Error("SMTP bind failed"));
          resolve(address.port);
        });
      });
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      for (let index = 0; index < messages.length; index += 1) messages[index] = "";
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function waitFor(predicate, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function waitForGoTrueReadiness(baseUrl, container, timeoutMs) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastProbe = { kind: "not-attempted" };
  while (Date.now() < deadline) {
    const state = containerRuntimeState(container);
    if (state.status === "exited" || state.status === "dead") {
      throw new Error(
        `GoTrue exited before readiness; status=${state.status}; exitCode=${state.exitCode}; restartCount=${state.restartCount}; lastProbe=${lastProbe.kind}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      lastProbe = { kind: "http", status: response.status };
      if (response.ok) return { elapsedMs: Date.now() - startedAt, status: response.status };
    } catch (error) {
      lastProbe = {
        kind: "connection-error",
        code: typeof error?.cause?.code === "string" ? error.cause.code : "unavailable",
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `timeout waiting for GoTrue readiness; lastProbe=${lastProbe.kind}${lastProbe.status ? `:${lastProbe.status}` : ""}${lastProbe.code ? `:${lastProbe.code}` : ""}`,
  );
}

async function waitForFinalPostgresReadiness(container, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lifecycleMarkerObserved = false;
  let lastConnectionStatus = "not-attempted";
  while (Date.now() < deadline) {
    const state = containerRuntimeState(container);
    if (state.status === "exited" || state.status === "dead") {
      throw new Error(
        `Postgres exited before final readiness; status=${state.status}; exitCode=${state.exitCode}; restartCount=${state.restartCount}`,
      );
    }
    if (!lifecycleMarkerObserved) {
      const logs = docker(["logs", "--tail", "200", container], { allowFailure: true });
      lifecycleMarkerObserved = `${logs.stdout}\n${logs.stderr}`.includes(POSTGRES_INIT_COMPLETE_MARKER);
    }
    if (lifecycleMarkerObserved && state.running) {
      const probe = postgresQuery(
        container,
        "select 1::text || '|' || (select count(*) from pg_namespace where nspname='auth')::text || '|' || (select count(*) from pg_tables where schemaname='auth')::text",
        true,
      );
      lastConnectionStatus = probe.status === 0 ? "connected" : "connection-failed";
      if (probe.status === 0) {
        const [selectOne, authSchemaCount, authTableCount] = probe.stdout.split("|");
        if (selectOne !== "1" || authSchemaCount !== "1" || authTableCount !== "0") {
          throw new Error(
            `Postgres final readiness invariant mismatch; selectOne=${selectOne}; authSchemaCount=${authSchemaCount}; authTableCount=${authTableCount}`,
          );
        }
        return {
          lifecycleMarkerObserved,
          containerRunning: state.running,
          selectOne: Number(selectOne),
          authSchemaCount: Number(authSchemaCount),
          authTableCount: Number(authTableCount),
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `timeout waiting for final Postgres readiness; lifecycleMarkerObserved=${lifecycleMarkerObserved}; lastConnectionStatus=${lastConnectionStatus}`,
  );
}

async function waitForMessage(messages, index) {
  await waitFor(() => messages.length > index, "synthetic SMTP delivery");
  const decoded = messages[index]
    .replace(/=\r\n/gu, "")
    .replace(/=3D/giu, "=")
    .replace(/=26/giu, "&")
    .replace(/&amp;/giu, "&");
  const urls = decoded.match(/https?:\/\/[^\s<>"']+/gu) ?? [];
  const verification = urls.find((url) => url.includes("/verify?") && url.includes("type=recovery"));
  if (!verification) fail("synthetic recovery delivery lacked a verification URL");
  return verification.replace(/[)>.,]+$/u, "");
}

async function jsonRequest(url, init, expectedStatuses = [200]) {
  const response = await fetch(url, { ...init, redirect: "manual" });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!expectedStatuses.includes(response.status)) {
    const sanitizedResponse = sanitizeDiagnostic(text).slice(0, 512) || "(empty response)";
    throw new Error(`unexpected Auth status ${response.status}; response=${sanitizedResponse}`);
  }
  return { response, body };
}

function postgresQuery(container, statement, allowFailure = false) {
  return docker(
    ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", statement],
    { allowFailure },
  );
}

function postgresQueryAs(container, username, password, statement, allowFailure = false) {
  return docker(
    [
      "exec", "-e", `PGPASSWORD=${password}`, container,
      "psql", "-h", "127.0.0.1", "-U", username, "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", statement,
    ],
    { allowFailure },
  );
}

function sql(container, statement) {
  return postgresQuery(container, statement).stdout;
}

function sqlCount(container, statement) {
  const value = Number(sql(container, statement));
  if (!Number.isInteger(value)) fail("database count was not an integer");
  return value;
}

function namespaceProbe(query, statement) {
  const result = query(statement, true);
  if (result.status === 0) {
    return { status: "ok", value: sanitizeDiagnostic(result.stdout) };
  }
  return {
    status: "error",
    stderr: sanitizeDiagnostic(result.stderr).slice(0, 512) || "(no stderr)",
  };
}

function captureNamespaceDiagnostics(container, runtime = null) {
  const query = runtime === null
    ? (statement, allowFailure) => postgresQuery(container, statement, allowFailure)
    : (statement, allowFailure) => postgresQueryAs(container, runtime.username, runtime.password, statement, allowFailure);
  return {
    currentUser: namespaceProbe(query, "select current_user"),
    searchPath: namespaceProbe(query, "show search_path"),
    unqualifiedIdentitiesRegclass: namespaceProbe(query, "select to_regclass('identities')"),
    qualifiedIdentitiesRegclass: namespaceProbe(query, "select to_regclass('auth.identities')"),
    authIdentitiesCount: namespaceProbe(query, "select count(*) from auth.identities"),
    authUsersCount: namespaceProbe(query, "select count(*) from auth.users"),
    unqualifiedIdentitiesCount: namespaceProbe(query, "select count(*) from identities"),
    qualifiedIdentitiesCount: namespaceProbe(query, "select count(*) from auth.identities"),
  };
}

function assertAuthRuntimePreflight(container, runtime) {
  const runtimeFacts = {
    currentUser: namespaceProbe(
      (statement, allowFailure) => postgresQueryAs(container, runtime.username, runtime.password, statement, allowFailure),
      "select current_user",
    ),
    searchPath: namespaceProbe(
      (statement, allowFailure) => postgresQueryAs(container, runtime.username, runtime.password, statement, allowFailure),
      "show search_path",
    ),
    databaseCreatePrivilege: namespaceProbe(
      (statement, allowFailure) => postgresQueryAs(container, runtime.username, runtime.password, statement, allowFailure),
      "select has_database_privilege(current_user, current_database(), 'CREATE')::int",
    ),
    authSchemaCount: namespaceProbe(
      (statement, allowFailure) => postgresQuery(container, statement, allowFailure),
      "select count(*) from pg_namespace where nspname='auth'",
    ),
    authTableCount: namespaceProbe(
      (statement, allowFailure) => postgresQuery(container, statement, allowFailure),
      "select count(*) from pg_tables where schemaname='auth'",
    ),
  };
  if (
    runtimeFacts.currentUser.status !== "ok" || runtimeFacts.currentUser.value !== runtime.username ||
    runtimeFacts.searchPath.status !== "ok" || runtimeFacts.searchPath.value !== "auth" ||
    runtimeFacts.databaseCreatePrivilege.status !== "ok" || runtimeFacts.databaseCreatePrivilege.value !== "1" ||
    runtimeFacts.authSchemaCount.status !== "ok" || runtimeFacts.authSchemaCount.value !== "1" ||
    runtimeFacts.authTableCount.status !== "ok" || runtimeFacts.authTableCount.value !== "0"
  ) {
    fail(`local Auth runtime preflight mismatch: ${JSON.stringify(runtimeFacts)}`);
  }
  return runtimeFacts;
}

function assertPostMigrationNamespaceContract(facts, runtimeUsername) {
  if (
    facts.currentUser.status !== "ok" || facts.currentUser.value !== runtimeUsername ||
    facts.searchPath.status !== "ok" || facts.searchPath.value !== "auth" ||
    facts.qualifiedIdentitiesRegclass.status !== "ok" || !facts.qualifiedIdentitiesRegclass.value ||
    facts.authIdentitiesCount.status !== "ok" || facts.authIdentitiesCount.value !== "0" ||
    facts.authUsersCount.status !== "ok" || facts.authUsersCount.value !== "0" ||
    facts.unqualifiedIdentitiesCount.status !== "ok" || facts.unqualifiedIdentitiesCount.value !== "0" ||
    facts.qualifiedIdentitiesCount.status !== "ok" || facts.qualifiedIdentitiesCount.value !== "0"
  ) {
    fail(`local Auth post-migration namespace contract mismatch: ${JSON.stringify(facts)}`);
  }
}

async function createConfirmedUser(baseUrl, adminToken, email, password) {
  const { body } = await jsonRequest(`${baseUrl}/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (typeof body?.id !== "string") fail("local admin fixture creation failed");
  return body.id;
}

async function passwordSession(baseUrl, email, password, userAgent) {
  const { body } = await jsonRequest(`${baseUrl}/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": userAgent },
    body: JSON.stringify({ email, password }),
  });
  if (typeof body?.access_token !== "string") fail("local password session creation failed");
  return body;
}

async function sendRecovery(baseUrl, publicKey, callbackUrl, email, challenge) {
  await jsonRequest(`${baseUrl}/recover?redirect_to=${encodeURIComponent(callbackUrl)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: publicKey,
      Authorization: `Bearer ${publicKey}`,
    },
    body: JSON.stringify({ email, code_challenge: challenge, code_challenge_method: "s256" }),
  });
}

async function consumeRecoveryLink(link, callbackUrl) {
  const response = await fetch(link, { redirect: "manual" });
  if (response.status !== 303) fail(`recovery verification returned ${response.status}`);
  const location = response.headers.get("location");
  if (!location) fail("recovery verification omitted redirect");
  const redirected = new URL(location);
  const callback = new URL(callbackUrl);
  if (redirected.origin !== callback.origin || redirected.pathname !== callback.pathname) fail("recovery redirect substitution");
  const values = redirected.searchParams.getAll("code");
  if (values.length !== 1 || !/^[0-9a-f-]{36}$/iu.test(values[0])) fail("recovery redirect omitted one auth code");
  return values[0];
}

async function exchange(baseUrl, publicKey, authCode, verifier, userAgent) {
  return jsonRequest(
    `${baseUrl}/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ auth_code: authCode, code_verifier: verifier }),
    },
    [200, 400, 404, 422],
  );
}

async function recoveryCode(baseUrl, publicKey, callbackUrl, email, messages) {
  const verifier = randomBytes(64).toString("base64url");
  const challengeBytes = await webcrypto.subtle.digest("SHA-256", Buffer.from(verifier));
  const challenge = Buffer.from(challengeBytes).toString("base64url");
  const messageIndex = messages.length;
  await sendRecovery(baseUrl, publicKey, callbackUrl, email, challenge);
  const link = await waitForMessage(messages, messageIndex);
  const authCode = await consumeRecoveryLink(link, callbackUrl);
  return { verifier, authCode };
}

async function main() {
  const dockerVersion = requireDocker();
  const suffix = randomUUID().slice(0, 8);
  const network = `r5e8k-net-${suffix}`;
  const database = `r5e8k-db-${suffix}`;
  const auth = `r5e8k-auth-${suffix}`;
  const smtp = startSmtpCapture();
  let smtpStarted = false;
  let networkCreated = false;
  let databaseCreated = false;
  let authCreated = false;
  try {
    const smtpPort = await smtp.listen();
    smtpStarted = true;
    const smtpHost = "host.docker.internal";
    const authPort = await freePort();
    const baseUrl = `http://127.0.0.1:${authPort}`;
    const callbackUrl = `${baseUrl}${CALLBACK_PATH}`;
    const postgresInitScript = resolve(packageRoot, "tests", "integration", "init-auth-runtime.sh");
    const jwtSecret = `synthetic-r5e8k-${randomBytes(32).toString("base64url")}`;
    const databasePassword = `synthetic-db-${randomBytes(24).toString("base64url")}`;
    const authDatabasePassword = `synthetic-auth-db-${randomBytes(24).toString("base64url")}`;
    const authDatabaseRuntime = { username: "supabase_auth_admin", password: authDatabasePassword };
    const smtpPassword = `synthetic-smtp-${randomBytes(18).toString("base64url")}`;
    const keyPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const privateJwk = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicJwk = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
    const keyId = randomUUID();
    Object.assign(privateJwk, { alg: "ES256", use: "sig", kid: keyId });
    Object.assign(publicJwk, { alg: "ES256", use: "sig", kid: keyId });
    const now = Math.floor(Date.now() / 1000);
    const adminToken = await signEs256Jwt(keyPair.privateKey, keyId, {
      iss: "supabase",
      aud: "authenticated",
      role: "service_role",
      iat: now,
      exp: now + 3600,
    });
    await assertFixtureAdminJwt(adminToken, publicJwk, now);
    const publicKey = signLegacyJwt(jwtSecret, {
      iss: "supabase",
      aud: "authenticated",
      role: "anon",
      iat: now,
      exp: now + 3600,
    });
    registerDiagnosticSecrets(
      jwtSecret,
      databasePassword,
      authDatabasePassword,
      smtpPassword,
      adminToken,
      publicKey,
      JSON.stringify(privateJwk),
      privateJwk.d,
    );

    docker(["pull", "--platform", "linux/amd64", GOTRUE_IMAGE], { timeout: 300_000 });
    const digests = docker(["image", "inspect", GOTRUE_IMAGE, "--format", "{{json .RepoDigests}}"] ).stdout;
    if (!digests.includes(GOTRUE_AMD64_DIGEST)) fail("pinned GoTrue platform digest verification failed");
    docker(["network", "create", network]);
    networkCreated = true;
    emitDiagnostic("startup-order", { step: 1, dependency: "smtp", status: smtp.status() });
    emitDiagnostic("startup-order", { step: 2, dependency: "docker-network", name: network });
    docker([
      "run", "-d", "--name", database, "--network", network,
      "-v", `${postgresInitScript}:/docker-entrypoint-initdb.d/00-r5e8k-auth-runtime.sh:ro`,
      "-e", `POSTGRES_PASSWORD=${databasePassword}`,
      "-e", "POSTGRES_DB=postgres",
      "-e", `R5E8K_AUTH_DB_PASSWORD=${authDatabasePassword}`,
      POSTGRES_IMAGE,
    ], { timeout: 120_000 });
    databaseCreated = true;
    emitDiagnostic("startup-order", { step: 3, dependency: "postgres", state: containerRuntimeState(database) });
    let postgresReadiness;
    try {
      postgresReadiness = await waitForFinalPostgresReadiness(database, 60_000);
      emitDiagnostic("startup-order", { step: 4, dependency: "postgres-final-ready", postgresReadiness });
      emitDiagnostic("auth-runtime-preflight", assertAuthRuntimePreflight(database, authDatabaseRuntime));
    } catch (error) {
      emitStartupDiagnostics({ network, database, auth, smtp });
      throw error;
    }

    docker([
      "run", "-d", "--name", auth, "--network", network,
      "--add-host", "host.docker.internal:host-gateway",
      "--platform", "linux/amd64",
      "-p", `127.0.0.1:${authPort}:9999`,
      "-e", "GOTRUE_API_HOST=0.0.0.0",
      "-e", "PORT=9999",
      "-e", `API_EXTERNAL_URL=${baseUrl}`,
      "-e", `GOTRUE_SITE_URL=${callbackUrl}`,
      "-e", `GOTRUE_URI_ALLOW_LIST=${callbackUrl}`,
      "-e", "GOTRUE_DB_DRIVER=postgres",
      "-e", `DATABASE_URL=postgres://${authDatabaseRuntime.username}:${authDatabasePassword}@${database}:5432/postgres?sslmode=disable`,
      "-e", "DB_NAMESPACE=auth",
      "-e", `GOTRUE_JWT_SECRET=${jwtSecret}`,
      "-e", `GOTRUE_JWT_KEYS=${JSON.stringify([privateJwk])}`,
      "-e", "GOTRUE_JWT_EXP=3600",
      "-e", "GOTRUE_JWT_AUD=authenticated",
      "-e", "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated",
      "-e", "GOTRUE_JWT_ADMIN_ROLES=service_role",
      "-e", "GOTRUE_EXTERNAL_EMAIL_ENABLED=true",
      "-e", "GOTRUE_DISABLE_SIGNUP=false",
      "-e", "GOTRUE_MAILER_AUTOCONFIRM=false",
      "-e", "GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true",
      "-e", "GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED=false",
      "-e", `GOTRUE_SMTP_HOST=${smtpHost}`,
      "-e", `GOTRUE_SMTP_PORT=${smtpPort}`,
      "-e", "GOTRUE_SMTP_USER=r5e8k-synthetic",
      "-e", `GOTRUE_SMTP_PASS=${smtpPassword}`,
      "-e", "GOTRUE_SMTP_ADMIN_EMAIL=r5e8k@example.invalid",
      "-e", "GOTRUE_SMTP_SENDER_NAME=R5E8K Synthetic",
      "-e", "GOTRUE_SMTP_MAX_FREQUENCY=100ms",
      "-e", "GOTRUE_RATE_LIMIT_EMAIL_SENT=30",
      "-e", "GOTRUE_EXTERNAL_FLOW_STATE_EXPIRY_DURATION=300s",
      "-e", "GOTRUE_LOG_LEVEL=error",
      GOTRUE_IMAGE,
    ], { timeout: 120_000 });
    authCreated = true;
    emitDiagnostic("startup-order", {
      step: 5,
      dependency: "gotrue-started",
      state: containerRuntimeState(auth),
      readiness: { origin: baseUrl, path: "/health", method: "GET" },
    });
    try {
      const readiness = await waitForGoTrueReadiness(baseUrl, auth, 90_000);
      emitDiagnostic("startup-order", { step: 6, dependency: "gotrue-ready", readiness });
      emitDiagnostic("runtime-ready", {
        postgres: containerDiagnostic(database),
        gotrue: containerDiagnostic(auth),
        smtp: smtp.status(),
        network: networkDiagnostic(network),
      });
    } catch (error) {
      emitStartupDiagnostics({ network, database, auth, smtp });
      throw error;
    }

    const namespaceBeforeFixture = captureNamespaceDiagnostics(database, authDatabaseRuntime);
    assertPostMigrationNamespaceContract(namespaceBeforeFixture, authDatabaseRuntime.username);
    emitDiagnostic("namespace-before-fixture", namespaceBeforeFixture);

    const currentEmail = `r5e8k-main-${suffix}@example.invalid`;
    const newEmail = `r5e8k-new-${suffix}@example.invalid`;
    const staleEmail = `r5e8k-stale-${suffix}@example.invalid`;
    const initialPassword = `Synthetic-Initial-${randomBytes(12).toString("base64url")}!`;
    const replacementPassword = `Synthetic-Replacement-${randomBytes(12).toString("base64url")}!`;
    let userId;
    try {
      userId = await createConfirmedUser(baseUrl, adminToken, currentEmail, initialPassword);
    } catch (error) {
      emitDiagnostic("namespace-after-fixture-failure", {
        database: captureNamespaceDiagnostics(database, authDatabaseRuntime),
        gotrueLogs: containerLogs(auth),
      });
      throw error;
    }
    const staleUserId = await createConfirmedUser(baseUrl, adminToken, staleEmail, initialPassword);

    const ordinaryOne = await passwordSession(baseUrl, currentEmail, initialPassword, "r5e8k-ordinary-1");
    const ordinaryTwo = await passwordSession(baseUrl, currentEmail, initialPassword, "r5e8k-ordinary-2");
    assertPasswordJwt(ordinaryOne.access_token, userId);
    assertPasswordJwt(ordinaryTwo.access_token, userId);
    const sessionsBeforeExchange = sqlCount(database, `select count(*) from auth.sessions where user_id='${userId}'`);
    if (sessionsBeforeExchange !== 2) fail("ordinary session precondition mismatch");

    const smtpProbe = smtpTransportProbe(auth, smtpHost, smtpPort);
    emitDiagnostic("smtp-before-recovery", smtpProbe);
    let mainFlow;
    try {
      mainFlow = await recoveryCode(baseUrl, publicKey, callbackUrl, currentEmail, smtp.messages);
    } catch (error) {
      emitDiagnostic("smtp-after-recovery-failure", recoveryFailureDiagnostics({
        error,
        auth,
        smtp,
        network,
        smtpHost,
        smtpPort,
        transportProbe: smtpProbe,
      }));
      throw error;
    }
    const wrongVerifier = `${mainFlow.verifier.slice(0, -1)}${mainFlow.verifier.endsWith("A") ? "B" : "A"}`;
    const wrong = await exchange(baseUrl, publicKey, mainFlow.authCode, wrongVerifier, "r5e8k-wrong-verifier");
    if (wrong.response.status === 200) fail("wrong PKCE verifier succeeded");
    const flowAfterWrongVerifier = sqlCount(database, `select count(*) from auth.flow_state where auth_code='${mainFlow.authCode}'`);
    if (flowAfterWrongVerifier !== 1) fail("wrong verifier consumed or duplicated flow state");

    const [attemptOne, attemptTwo] = await Promise.all([
      exchange(baseUrl, publicKey, mainFlow.authCode, mainFlow.verifier, "r5e8k-simultaneous-1"),
      exchange(baseUrl, publicKey, mainFlow.authCode, mainFlow.verifier, "r5e8k-simultaneous-2"),
    ]);
    const attempts = [attemptOne, attemptTwo];
    const successes = attempts.filter((attempt) => attempt.response.status === 200);
    const rejections = attempts.filter((attempt) => attempt.response.status !== 200);
    if (successes.length === 2) {
      throw new Error("CONCURRENCY_INVARIANT_BREACH: two simultaneous exchanges produced two successful sessions");
    }
    if (successes.length !== 1 || rejections.length !== 1) fail("simultaneous exchange cardinality mismatch");
    const recoveryAccessToken = successes[0].body?.access_token;
    if (typeof recoveryAccessToken !== "string") fail("successful PKCE exchange omitted access token");
    const verifiedRecovery = await assertRecoveryJwt(recoveryAccessToken, publicJwk, {
      issuer: baseUrl,
      subject: userId,
      email: currentEmail,
    });
    const sessionsAfterExchange = sqlCount(database, `select count(*) from auth.sessions where user_id='${userId}'`);
    const recoverySessionCount = sqlCount(database, `select count(*) from auth.sessions where id='${verifiedRecovery.sessionId}' and user_id='${userId}'`);
    const recoveryAmrCount = sqlCount(database, `select count(*) from auth.mfa_amr_claims where session_id='${verifiedRecovery.sessionId}' and authentication_method='recovery'`);
    const flowAfterExchange = sqlCount(database, `select count(*) from auth.flow_state where auth_code='${mainFlow.authCode}'`);
    if (sessionsAfterExchange !== sessionsBeforeExchange + 1 || recoverySessionCount !== 1 || recoveryAmrCount !== 1 || flowAfterExchange !== 0) {
      fail("simultaneous exchange database postcondition mismatch");
    }

    const emailMessageIndex = smtp.messages.length;
    const emailUpdate = await jsonRequest(`${baseUrl}/user?redirect_to=${encodeURIComponent(callbackUrl)}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: `Bearer ${recoveryAccessToken}`,
      },
      body: JSON.stringify({ email: newEmail }),
    });
    if (emailUpdate.body?.id !== userId || emailUpdate.body?.email !== currentEmail || emailUpdate.body?.new_email !== newEmail) {
      fail("pending email response mismatch");
    }
    await waitFor(() => smtp.messages.length >= emailMessageIndex + 2, "two secure email-change deliveries");
    const pendingState = sql(database, `select (email_change='${newEmail}')::int || '|' || email_change_confirm_status || '|' || (email_change_sent_at is not null)::int from auth.users where id='${userId}'`);
    const pendingNewTokens = sqlCount(database, `select count(*) from auth.one_time_tokens where user_id='${userId}' and token_type='email_change_token_new'`);
    const pendingCurrentTokens = sqlCount(database, `select count(*) from auth.one_time_tokens where user_id='${userId}' and token_type='email_change_token_current'`);
    if (pendingState !== "1|0|1" || pendingNewTokens !== 1 || pendingCurrentTokens !== 1) {
      fail("secure email-change pending-state mismatch");
    }

    const originalTokenDigest = createHmac("sha256", "r5e8k-equality-only").update(recoveryAccessToken).digest("hex");
    const passwordAuthorizationToken = recoveryAccessToken;
    if (createHmac("sha256", "r5e8k-equality-only").update(passwordAuthorizationToken).digest("hex") !== originalTokenDigest) {
      fail("original access-token equality invariant failed");
    }
    const passwordUpdate = await jsonRequest(`${baseUrl}/user`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: `Bearer ${passwordAuthorizationToken}`,
      },
      body: JSON.stringify({ password: replacementPassword }),
    });
    if (passwordUpdate.body?.id !== userId || passwordUpdate.body?.email !== currentEmail) fail("password update response mismatch");

    const sessionsAfterPassword = sqlCount(database, `select count(*) from auth.sessions where user_id='${userId}'`);
    const sameRecoverySessionAfterPassword = sqlCount(database, `select count(*) from auth.sessions where id='${verifiedRecovery.sessionId}' and user_id='${userId}'`);
    const tokensAfterPassword = sqlCount(database, `select count(*) from auth.one_time_tokens where user_id='${userId}'`);
    const legacyTokensCleared = sql(database, `select ((email_change_token_current='' and email_change_token_new='' and recovery_token='')::int)::text from auth.users where id='${userId}'`);
    const pendingBindingPreserved = sql(database, `select ((email_change='${newEmail}' and email_change_confirm_status=0)::int)::text from auth.users where id='${userId}'`);
    if (
      sessionsAfterPassword !== 1 ||
      sameRecoverySessionAfterPassword !== 1 ||
      tokensAfterPassword !== 0 ||
      legacyTokensCleared !== "1" ||
      pendingBindingPreserved !== "1"
    ) {
      fail("password update session/token fencing mismatch");
    }

    const staleFlow = await recoveryCode(baseUrl, publicKey, callbackUrl, staleEmail, smtp.messages);
    sql(database, `update auth.flow_state set created_at=now()-interval '301 seconds' where auth_code='${staleFlow.authCode}' and user_id='${staleUserId}'`);
    const staleAttempt = await exchange(baseUrl, publicKey, staleFlow.authCode, staleFlow.verifier, "r5e8k-stale-flow");
    if (staleAttempt.response.status !== 422) fail("stale PKCE flow did not return 422");
    const staleSessions = sqlCount(database, `select count(*) from auth.sessions where user_id='${staleUserId}'`);
    const staleResidualFlows = sqlCount(database, `select count(*) from auth.flow_state where user_id='${staleUserId}'`);
    if (staleSessions !== 0 || staleResidualFlows !== 1) fail("stale flow state postcondition mismatch");

    const legacyRefreshRows = sqlCount(database, `select count(*) from auth.refresh_tokens where user_id='${userId}'`);
    const sessionBackedRefreshRows = sqlCount(database, `select count(*) from auth.sessions where user_id='${userId}' and refresh_token_hmac_key is not null and refresh_token_counter is not null`);
    const result = {
      schema: "r5e8k-gotrue-integration-evidence/v1",
      dockerServerVersion: dockerVersion,
      goTrueTag: GOTRUE_TAG,
      goTrueManifestDigest: GOTRUE_MANIFEST_DIGEST,
      goTruePlatform: "linux/amd64",
      goTruePlatformDigest: GOTRUE_AMD64_DIGEST,
      tests: {
        signedRecoveryAmr: "PASS",
        wrongVerifierRejected: "PASS",
        staleFlowRejected: "PASS",
        pendingEmailStateCreated: "PASS",
        passwordPreservedCurrentRecoverySession: "PASS",
        passwordDeletedOtherSessions: "PASS",
        passwordClearedEmailChangeAuthority: "PASS",
        originalAccessTokenUsedForBothMutations: "PASS",
        simultaneousExchange: {
          successes: successes.length,
          rejections: rejections.length,
          recoverySessionDelta: sessionsAfterExchange - sessionsBeforeExchange,
          consumedFlowStateCount: flowAfterExchange,
        },
      },
      sanitizedState: {
        sessionsBeforeExchange,
        sessionsAfterExchange,
        sessionsAfterPassword,
        pendingNewTokens,
        pendingCurrentTokens,
        tokensAfterPassword,
        sessionBackedRefreshRows,
        legacyRefreshRows,
        fixtureFlowResiduals: 0,
        staleTestFlowResiduals: staleResidualFlows,
        syntheticDeliveries: smtp.messages.length,
      },
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    if (authCreated) docker(["rm", "-f", auth], { allowFailure: true });
    if (databaseCreated) docker(["rm", "-f", database], { allowFailure: true });
    if (networkCreated) docker(["network", "rm", network], { allowFailure: true });
    if (smtpStarted) await smtp.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown local integration failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = message.startsWith("LOCAL_BACKEND_UNAVAILABLE:") ? 2 : 1;
}
