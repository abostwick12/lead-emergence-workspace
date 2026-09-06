import assert from "node:assert/strict";
import { once } from "node:events";
import { readdirSync, statSync } from "node:fs";
import { connect as connectTcp } from "node:net";
import { dirname } from "node:path";
import { test } from "node:test";
import { connect as connectTls } from "node:tls";
import { createEphemeralSmtpTlsMaterial, startSmtpCapture } from "../../scripts/synthetic-smtp.mjs";

const HOSTNAME = "host.docker.internal";
const USERNAME = "r5e8k-synthetic";
const PASSWORD = "synthetic-smtp-test-password";

class SmtpClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.lines = [];
    this.responses = [];
    this.waiters = [];
    this.onData = (chunk) => this.receive(chunk);
    this.onError = (error) => this.fail(error);
    socket.on("data", this.onData);
    socket.on("error", this.onError);
  }

  receive(chunk) {
    this.buffer += Buffer.from(chunk).toString("utf8");
    while (this.buffer.includes("\r\n")) {
      const boundary = this.buffer.indexOf("\r\n");
      const line = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.lines.push(line);
      if (/^\d{3} /u.test(line)) {
        const response = { code: Number(line.slice(0, 3)), lines: this.lines };
        this.lines = [];
        const waiter = this.waiters.shift();
        if (waiter) waiter.resolve(response);
        else this.responses.push(response);
      }
    }
  }

  fail(error) {
    while (this.waiters.length > 0) this.waiters.shift().reject(error);
  }

  nextResponse() {
    if (this.responses.length > 0) return Promise.resolve(this.responses.shift());
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async command(command) {
    this.socket.write(`${command}\r\n`);
    return this.nextResponse();
  }

  detach() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    return this.socket;
  }

  async close() {
    if (this.socket.destroyed) return;
    this.socket.end("QUIT\r\n");
    await once(this.socket, "close");
  }
}

async function openPlainClient(port) {
  const socket = connectTcp({ host: "127.0.0.1", port });
  await once(socket, "connect");
  const client = new SmtpClient(socket);
  const greeting = await client.nextResponse();
  assert.equal(greeting.code, 220);
  return client;
}

async function upgradeToTls(client, options) {
  const startTls = await client.command("STARTTLS");
  assert.equal(startTls.code, 220);
  const socket = client.detach();
  const tlsSocket = connectTls({ socket, rejectUnauthorized: true, ...options });
  await once(tlsSocket, "secureConnect");
  return new SmtpClient(tlsSocket);
}

function plainAuth(username, password) {
  return Buffer.from(`\u0000${username}\u0000${password}`, "utf8").toString("base64");
}

async function withSmtp(run) {
  const material = createEphemeralSmtpTlsMaterial(HOSTNAME);
  const smtp = startSmtpCapture({ hostname: HOSTNAME, username: USERNAME, password: PASSWORD, tlsMaterial: material });
  const port = await smtp.listen();
  try {
    await run({ material, smtp, port });
  } finally {
    await smtp.close();
    material.dispose();
  }
}

test("plaintext SMTP advertises only STARTTLS and rejects AUTH", async () => {
  await withSmtp(async ({ port }) => {
    const client = await openPlainClient(port);
    const ehlo = await client.command("EHLO r5e8k-test");
    assert.equal(ehlo.code, 250);
    assert.ok(ehlo.lines.includes("250-STARTTLS"));
    assert.ok(ehlo.lines.every((line) => !line.includes("AUTH")));
    const auth = await client.command(`AUTH PLAIN ${plainAuth(USERNAME, PASSWORD)}`);
    assert.equal(auth.code, 538);
    await client.close();
  });
});

test("STARTTLS requires fresh EHLO, authenticates correctly, and captures one DATA transaction", async () => {
  await withSmtp(async ({ material, smtp, port }) => {
    const plain = await openPlainClient(port);
    await plain.command("EHLO r5e8k-test");
    const secure = await upgradeToTls(plain, { ca: material.caCertificatePem, servername: HOSTNAME });

    const preEhloAuth = await secure.command(`AUTH PLAIN ${plainAuth(USERNAME, PASSWORD)}`);
    assert.equal(preEhloAuth.code, 503);
    const ehlo = await secure.command("EHLO r5e8k-test-after-tls");
    assert.equal(ehlo.code, 250);
    assert.ok(ehlo.lines.includes("250-AUTH PLAIN LOGIN"));
    assert.ok(ehlo.lines.every((line) => !line.includes("STARTTLS")));
    const secondStartTls = await secure.command("STARTTLS");
    assert.equal(secondStartTls.code, 454);

    const wrongCredentials = await secure.command(`AUTH PLAIN ${plainAuth(USERNAME, "wrong-password")}`);
    assert.equal(wrongCredentials.code, 535);
    const authenticated = await secure.command(`AUTH PLAIN ${plainAuth(USERNAME, PASSWORD)}`);
    assert.equal(authenticated.code, 235);
    assert.equal((await secure.command("MAIL FROM:<sender@example.invalid>")).code, 250);
    assert.equal((await secure.command("RCPT TO:<recipient@example.invalid>")).code, 250);
    assert.equal((await secure.command("DATA")).code, 354);
    secure.socket.write("Subject: synthetic SMTP test\r\n\r\nbody\r\n.\r\n");
    assert.equal((await secure.nextResponse()).code, 250);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /^Subject: synthetic SMTP test/mu);
    await secure.close();
  });
});

test("the ephemeral certificate is narrowly scoped and rejects wrong trust or hostname", async () => {
  await withSmtp(async ({ material, port }) => {
    assert.deepEqual(material.diagnostics.sanDns, [HOSTNAME]);
    assert.equal(material.diagnostics.chainsToGeneratedCa, true);
    assert.equal(material.diagnostics.currentlyValid, true);
    assert.doesNotMatch(material.caCertificatePem.toString("utf8"), /PRIVATE KEY/u);
    assert.equal(statSync(material.caPath).mode & 0o777, process.platform === "win32" ? 0o666 : 0o644);
    assert.deepEqual(readdirSync(dirname(material.caPath)), ["synthetic-ca.pem"]);

    const untrustedMaterial = createEphemeralSmtpTlsMaterial(HOSTNAME);
    try {
      const untrusted = await openPlainClient(port);
      await untrusted.command("EHLO r5e8k-test");
      await assert.rejects(
        upgradeToTls(untrusted, { ca: untrustedMaterial.caCertificatePem, servername: HOSTNAME }),
      );

      const wrongHostname = await openPlainClient(port);
      await wrongHostname.command("EHLO r5e8k-test");
      await assert.rejects(
        upgradeToTls(wrongHostname, { ca: material.caCertificatePem, servername: "wrong.example.invalid" }),
      );
    } finally {
      untrustedMaterial.dispose();
    }
  });
});
