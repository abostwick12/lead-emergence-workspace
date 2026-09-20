const TIMESTAMP_WINDOW_SECONDS = 300;
const MAX_PROJECTION_BODY_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/i;

type ProjectionKind = "BILLING" | "NON_BILLING_AUTHORITY";
type ProjectionData = Record<string, string | boolean | null>;

export type ProjectionEnvelope = {
  protocol_version: "1";
  delivery_id: string;
  projection_kind: ProjectionKind;
  projection_version: number;
  canonical_user_id: string;
  projected_at: string;
  projection_data: ProjectionData;
};

type ProjectionHandlerDependencies = {
  secret: string;
  apply: (envelope: ProjectionEnvelope) => Promise<unknown>;
  now?: () => number;
};

export class ProjectionConflictError extends Error {
  constructor() {
    super("Projection conflict.");
    this.name = "ProjectionConflictError";
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableTimestamp(value: unknown) {
  return value === null || isIsoTimestamp(value);
}

function validProjectionData(kind: ProjectionKind, data: unknown): data is ProjectionData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  if (kind === "BILLING") {
    const states = new Set([
      "TRIALING",
      "ACTIVE",
      "PAYMENT_GRACE",
      "PAUSED_NO_PAYMENT_METHOD",
      "SUSPENDED_PAYMENT",
      "CANCEL_AT_PERIOD_END",
      "CANCELED",
    ]);
    const timestampKeys = [
      "trial_started_at",
      "trial_ends_at",
      "current_period_started_at",
      "current_period_ends_at",
      "grace_until",
    ];
    return exactKeys(value, [
      "effective_state",
      ...timestampKeys,
      "cancel_at_period_end",
      "payment_method_required",
    ])
      && states.has(value.effective_state as string)
      && timestampKeys.every((key) => isNullableTimestamp(value[key]))
      && typeof value.cancel_at_period_end === "boolean"
      && typeof value.payment_method_required === "boolean";
  }

  return exactKeys(value, ["authority_kind", "entitlement_status", "source"])
    && (value.authority_kind === "SPONSORED_ACCESS" || value.authority_kind === "INTERNAL_OPERATOR")
    && (value.entitlement_status === "ACTIVE" || value.entitlement_status === "SUSPENDED" || value.entitlement_status === "REVOKED")
    && typeof value.source === "string"
    && value.source.trim().length >= 1
    && value.source.trim().length <= 120;
}

function parseEnvelope(rawBody: string): ProjectionEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (!exactKeys(value, [
    "protocol_version",
    "delivery_id",
    "projection_kind",
    "projection_version",
    "canonical_user_id",
    "projected_at",
    "projection_data",
  ])) return null;
  if (value.protocol_version !== "1"
    || typeof value.delivery_id !== "string"
    || !UUID_PATTERN.test(value.delivery_id)
    || (value.projection_kind !== "BILLING" && value.projection_kind !== "NON_BILLING_AUTHORITY")
    || typeof value.projection_version !== "number"
    || !Number.isSafeInteger(value.projection_version)
    || value.projection_version <= 0
    || typeof value.canonical_user_id !== "string"
    || !UUID_PATTERN.test(value.canonical_user_id)
    || !isIsoTimestamp(value.projected_at)
    || !validProjectionData(value.projection_kind, value.projection_data)) {
    return null;
  }
  return value as ProjectionEnvelope;
}

function hexBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string) {
  if (!signature.startsWith("v1=")) return false;
  const digest = signature.slice(3);
  if (!HEX_SHA256_PATTERN.test(digest)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexBytes(digest),
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
}

async function readProjectionBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_PROJECTION_BODY_BYTES) {
    return null;
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLength += value.byteLength;
    if (totalLength > MAX_PROJECTION_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export function createPersonalAuthorityProjectionHandler({
  secret,
  apply,
  now = () => Date.now(),
}: ProjectionHandlerDependencies) {
  if (secret.length < 32) throw new Error("Projection HMAC secret must contain at least 32 characters.");

  return async (request: Request) => {
    if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const timestamp = request.headers.get("x-le-projection-timestamp");
    const signature = request.headers.get("x-le-projection-signature");
    if (!timestamp || !signature || !/^\d{10}$/.test(timestamp)) {
      return json(401, { error: "PROJECTION_AUTHENTICATION_REQUIRED" });
    }
    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_WINDOW_SECONDS) {
      return json(401, { error: "PROJECTION_TIMESTAMP_REJECTED" });
    }

    const rawBody = await readProjectionBody(request);
    if (rawBody === null) return json(413, { error: "PROJECTION_PAYLOAD_TOO_LARGE" });
    if (!await verifySignature(secret, timestamp, rawBody, signature)) {
      return json(401, { error: "PROJECTION_SIGNATURE_REJECTED" });
    }

    const envelope = parseEnvelope(rawBody);
    if (!envelope) return json(400, { error: "INVALID_PROJECTION_PAYLOAD" });

    try {
      const result = await apply(envelope);
      return json(200, { accepted: true, result });
    } catch (error) {
      if (error instanceof ProjectionConflictError) {
        return json(409, { error: "PROJECTION_REJECTED" });
      }
      return json(503, { error: "PROJECTION_TEMPORARILY_UNAVAILABLE" });
    }
  };
}

export { MAX_PROJECTION_BODY_BYTES, TIMESTAMP_WINDOW_SECONDS };
