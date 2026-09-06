import { createSign, generateKeyPairSync, randomBytes, timingSafeEqual, X509Certificate } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureContext, TLSSocket } from "node:tls";

const SMTP_GREETING = "220 r5e8k.synthetic ESMTP";
const TLS_REQUIRED = "538 5.7.11 Encryption required";
const FRESH_EHLO_REQUIRED = "503 5.5.1 Send EHLO after STARTTLS";
const AUTH_REQUIRED = "530 5.7.0 Authentication required";
const CA_VALIDITY_MS = 15 * 60 * 1000;

function derLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, content) {
  const value = Buffer.from(content);
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

function derSequence(...values) {
  return der(0x30, Buffer.concat(values));
}

function derSet(...values) {
  return der(0x31, Buffer.concat(values));
}

function derInteger(value) {
  let bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from([value]);
  while (bytes.length > 1 && bytes[0] === 0) bytes = bytes.subarray(1);
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return der(0x02, bytes);
}

function derBoolean(value) {
  return der(0x01, Buffer.from([value ? 0xff : 0]));
}

function derUtf8(value) {
  return der(0x0c, Buffer.from(value, "utf8"));
}

function derUtcTime(value) {
  const pad = (number) => String(number).padStart(2, "0");
  const year = String(value.getUTCFullYear()).slice(-2);
  return der(0x17, Buffer.from(`${year}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`));
}

function derBitString(value) {
  return der(0x03, Buffer.concat([Buffer.from([0]), Buffer.from(value)]));
}

function derOctetString(value) {
  return der(0x04, Buffer.from(value));
}

function derObjectIdentifier(value) {
  const parts = value.split(".").map((part) => Number(part));
  const encoded = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const bytes = [part & 0x7f];
    for (let remainder = part >>> 7; remainder > 0; remainder >>>= 7) bytes.unshift((remainder & 0x7f) | 0x80);
    encoded.push(...bytes);
  }
  return der(0x06, Buffer.from(encoded));
}

function derContext(tagNumber, value) {
  return der(0xa0 + tagNumber, value);
}

function distinguishedName(commonName) {
  return derSequence(derSet(derSequence(derObjectIdentifier("2.5.4.3"), derUtf8(commonName))));
}

function extension(identifier, value, critical = false) {
  return derSequence(
    derObjectIdentifier(identifier),
    ...(critical ? [derBoolean(true)] : []),
    derOctetString(value),
  );
}

function certificatePem(derBytes) {
  const base64 = Buffer.from(derBytes).toString("base64").match(/.{1,64}/gu).join("\n");
  return Buffer.from(`-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`, "utf8");
}

function certificateSignatureAlgorithm() {
  return derSequence(derObjectIdentifier("1.2.840.10045.4.3.2"));
}

function buildCertificate({ subjectName, issuerName, subjectPublicKey, issuerPrivateKey, validFrom, validTo, isCa, hostname }) {
  const extensions = [
    extension("2.5.29.19", derSequence(...(isCa ? [derBoolean(true)] : [])), true),
    extension("2.5.29.15", derBitString(Buffer.from([isCa ? 0x06 : 0xa0])), true),
  ];
  if (!isCa) {
    extensions.push(
      extension("2.5.29.37", derSequence(derObjectIdentifier("1.3.6.1.5.5.7.3.1"))),
      extension("2.5.29.17", derSequence(der(0x82, Buffer.from(hostname, "ascii")))),
    );
  }
  const serial = randomBytes(16);
  serial[0] &= 0x7f;
  if (serial[0] === 0) serial[0] = 1;
  const tbsCertificate = derSequence(
    derContext(0, derInteger(2)),
    derInteger(serial),
    certificateSignatureAlgorithm(),
    distinguishedName(issuerName),
    derSequence(derUtcTime(validFrom), derUtcTime(validTo)),
    distinguishedName(subjectName),
    subjectPublicKey.export({ type: "spki", format: "der" }),
    derContext(3, derSequence(...extensions)),
  );
  const signer = createSign("SHA256");
  signer.update(tbsCertificate);
  signer.end();
  const signature = signer.sign({ key: issuerPrivateKey, dsaEncoding: "der" });
  return derSequence(tbsCertificate, certificateSignatureAlgorithm(), derBitString(signature));
}

function assertCertificateContract({ caCertificate, serverCertificate, hostname, now }) {
  const validFrom = Date.parse(serverCertificate.validFrom);
  const validTo = Date.parse(serverCertificate.validTo);
  if (
    serverCertificate.subjectAltName !== `DNS:${hostname}` ||
    serverCertificate.checkHost(hostname) !== hostname ||
    !serverCertificate.verify(caCertificate.publicKey) ||
    !Number.isFinite(validFrom) ||
    !Number.isFinite(validTo) ||
    now < validFrom ||
    now > validTo
  ) {
    throw new Error("synthetic SMTP certificate contract mismatch");
  }
  return {
    sanDns: [hostname],
    chainsToGeneratedCa: true,
    currentlyValid: true,
    validFrom: serverCertificate.validFrom,
    validTo: serverCertificate.validTo,
  };
}

export function createEphemeralSmtpTlsMaterial(hostname) {
  const now = Date.now();
  const validFrom = new Date(now - 60_000);
  const validTo = new Date(now + CA_VALIDITY_MS);
  const caName = `r5e8k-synthetic-ca-${randomBytes(8).toString("hex")}`;
  let caKeyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const caDer = buildCertificate({
    subjectName: caName,
    issuerName: caName,
    subjectPublicKey: caKeyPair.publicKey,
    issuerPrivateKey: caKeyPair.privateKey,
    validFrom,
    validTo,
    isCa: true,
  });
  let serverKeyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const serverDer = buildCertificate({
    subjectName: hostname,
    issuerName: caName,
    subjectPublicKey: serverKeyPair.publicKey,
    issuerPrivateKey: caKeyPair.privateKey,
    validFrom,
    validTo,
    isCa: false,
    hostname,
  });
  const caCertificatePem = certificatePem(caDer);
  const serverCertificatePem = certificatePem(serverDer);
  const serverPrivateKeyPem = Buffer.from(serverKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }));
  const caCertificate = new X509Certificate(caCertificatePem);
  const serverCertificate = new X509Certificate(serverCertificatePem);
  const diagnostics = assertCertificateContract({ caCertificate, serverCertificate, hostname, now });
  const directory = mkdtempSync(join(tmpdir(), "r5e8k-smtp-"));
  const caPath = join(directory, "synthetic-ca.pem");
  // This is a public trust anchor. The non-root GoTrue container user must read
  // it through the existing read-only bind mount; private keys remain in memory.
  writeFileSync(caPath, caCertificatePem, { mode: 0o644 });
  chmodSync(caPath, 0o644);
  const secureContext = createSecureContext({
    key: serverPrivateKeyPem,
    cert: serverCertificatePem,
    minVersion: "TLSv1.2",
  });
  serverPrivateKeyPem.fill(0);
  caKeyPair = null;
  serverKeyPair = null;
  let disposed = false;
  return {
    hostname,
    caPath,
    caCertificatePem,
    secureContext,
    diagnostics,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (existsSync(directory)) rmSync(directory, { recursive: true, force: true, maxRetries: 2 });
    },
  };
}

function credentialsMatch(actual, expected) {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function decodeBase64(value) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function parsePlainCredentials(value) {
  const decoded = decodeBase64(value);
  if (decoded === null) return null;
  const parts = decoded.split("\u0000");
  if (parts.length !== 3) return null;
  return { username: parts[1], password: parts[2] };
}

export function startSmtpCapture({ hostname, username, password, tlsMaterial }) {
  const messages = [];
  const sockets = new Set();
  let acceptedConnections = 0;
  const server = createServer((socket) => {
    acceptedConnections += 1;
    sockets.add(socket);
    runSession(socket, { tlsActive: false, greeting: true });
  });

  function runSession(socket, { tlsActive, greeting }) {
    const state = {
      tlsActive,
      hello: false,
      authenticated: false,
      authLoginStep: 0,
      loginUsername: "",
      authPlainAwaiting: false,
      mailFrom: false,
      recipients: 0,
      dataMode: false,
      dataLines: [],
    };
    let buffer = "";
    const onData = (chunk) => {
      buffer += Buffer.from(chunk).toString("utf8");
      while (buffer.includes("\r\n")) {
        const boundary = buffer.indexOf("\r\n");
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (state.dataMode) {
          if (line === ".") {
            messages.push(state.dataLines.join("\r\n"));
            state.dataMode = false;
            state.dataLines = [];
            socket.write("250 2.0.0 accepted\r\n");
          } else {
            state.dataLines.push(line.startsWith("..") ? line.slice(1) : line);
          }
          continue;
        }
        if (state.authPlainAwaiting) {
          state.authPlainAwaiting = false;
          authenticatePlain(line);
          continue;
        }
        if (state.authLoginStep === 1) {
          state.loginUsername = decodeBase64(line) ?? "";
          state.authLoginStep = 2;
          socket.write("334 UGFzc3dvcmQ6\r\n");
          continue;
        }
        if (state.authLoginStep === 2) {
          const loginPassword = decodeBase64(line) ?? "";
          state.authLoginStep = 0;
          finishAuthentication(state.loginUsername, loginPassword);
          continue;
        }
        handleCommand(line);
      }
    };

    function finishAuthentication(actualUsername, actualPassword) {
      if (credentialsMatch(actualUsername, username) && credentialsMatch(actualPassword, password)) {
        state.authenticated = true;
        socket.write("235 2.7.0 authenticated\r\n");
      } else {
        socket.write("535 5.7.8 Authentication credentials invalid\r\n");
      }
    }

    function authenticatePlain(value) {
      const credentials = parsePlainCredentials(value);
      if (credentials === null) {
        socket.write("535 5.7.8 Authentication credentials invalid\r\n");
        return;
      }
      finishAuthentication(credentials.username, credentials.password);
    }

    function requireAuthenticated() {
      if (!state.tlsActive) {
        socket.write(`${TLS_REQUIRED}\r\n`);
        return false;
      }
      if (!state.hello) {
        socket.write(`${FRESH_EHLO_REQUIRED}\r\n`);
        return false;
      }
      if (!state.authenticated) {
        socket.write(`${AUTH_REQUIRED}\r\n`);
        return false;
      }
      return true;
    }

    function upgradeToTls() {
      socket.off("data", onData);
      if (buffer.length > 0) {
        socket.destroy();
        return;
      }
      const secureSocket = new TLSSocket(socket, { isServer: true, secureContext: tlsMaterial.secureContext });
      sockets.delete(socket);
      sockets.add(secureSocket);
      secureSocket.once("secure", () => runSession(secureSocket, { tlsActive: true, greeting: false }));
      secureSocket.once("error", () => secureSocket.destroy());
      secureSocket.once("close", () => sockets.delete(secureSocket));
    }

    function handleCommand(line) {
      const [verb = "", ...parameters] = line.split(" ");
      const command = verb.toUpperCase();
      const parameter = parameters.join(" ");
      if (command === "EHLO" || command === "HELO") {
        state.hello = true;
        const capabilities = state.tlsActive
          ? ["250-r5e8k.synthetic", "250-AUTH PLAIN LOGIN", "250 SIZE 1048576"]
          : ["250-r5e8k.synthetic", "250-STARTTLS", "250 SIZE 1048576"];
        socket.write(`${capabilities.join("\r\n")}\r\n`);
        return;
      }
      if (command === "STARTTLS") {
        if (!state.hello) {
          socket.write("503 5.5.1 Send EHLO before STARTTLS\r\n");
        } else if (state.tlsActive) {
          socket.write("454 4.7.0 TLS already active\r\n");
        } else {
          socket.write("220 2.0.0 Ready to start TLS\r\n");
          upgradeToTls();
        }
        return;
      }
      if (command === "AUTH") {
        if (!state.tlsActive) {
          socket.write(`${TLS_REQUIRED}\r\n`);
        } else if (!state.hello) {
          socket.write(`${FRESH_EHLO_REQUIRED}\r\n`);
        } else if (state.authenticated) {
          socket.write("503 5.5.1 Already authenticated\r\n");
        } else if (parameter.toUpperCase().startsWith("PLAIN")) {
          const initialResponse = parameter.slice(5).trim();
          if (initialResponse) authenticatePlain(initialResponse);
          else {
            state.authPlainAwaiting = true;
            socket.write("334 \r\n");
          }
        } else if (parameter.toUpperCase() === "LOGIN") {
          state.authLoginStep = 1;
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else {
          socket.write("504 5.5.4 Unsupported authentication mechanism\r\n");
        }
        return;
      }
      if (command === "MAIL") {
        if (!requireAuthenticated()) return;
        state.mailFrom = true;
        state.recipients = 0;
        socket.write("250 2.0.0 ok\r\n");
        return;
      }
      if (command === "RCPT") {
        if (!requireAuthenticated()) return;
        if (!state.mailFrom) {
          socket.write("503 5.5.1 Need MAIL before RCPT\r\n");
          return;
        }
        state.recipients += 1;
        socket.write("250 2.0.0 ok\r\n");
        return;
      }
      if (command === "DATA") {
        if (!requireAuthenticated()) return;
        if (!state.mailFrom || state.recipients === 0) {
          socket.write("503 5.5.1 Need MAIL and RCPT before DATA\r\n");
          return;
        }
        state.dataMode = true;
        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        return;
      }
      if (command === "QUIT") {
        socket.end("221 2.0.0 bye\r\n");
        return;
      }
      socket.write("500 5.5.2 Unsupported command\r\n");
    }

    socket.on("data", onData);
    socket.once("close", () => sockets.delete(socket));
    socket.once("error", () => socket.destroy());
    if (greeting) socket.write(`${SMTP_GREETING}\r\n`);
  }

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
        starttlsRequired: true,
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
