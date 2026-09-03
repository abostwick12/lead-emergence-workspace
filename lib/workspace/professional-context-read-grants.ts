import * as z from "zod/v4";

export const professionalContextGrantMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("grant"),
    clientId: z.string().trim().min(1).max(500),
    privacyScope: z.enum(["private", "sensitive"]),
    csrfToken: z.string().min(32).max(128),
  }),
  z.strictObject({
    action: z.literal("revoke"),
    grantId: z.uuid(),
    csrfToken: z.string().min(32).max(128),
  }),
]);

const professionalContextReadGrantSchema = z.strictObject({
  grant_id: z.uuid(),
  client_id: z.string().min(1).max(500),
  privacy_scope: z.enum(["private", "sensitive"]),
  issued_at: z.string(),
  expires_at: z.string(),
  status: z.enum(["active", "expired", "revoked"]),
});

const professionalContextReadGrantEnvelopeSchema = z.strictObject({
  grants: z.array(professionalContextReadGrantSchema),
});

export type ProfessionalContextPrivacyScope = "private" | "sensitive";
export type ProfessionalContextReadGrant = z.infer<typeof professionalContextReadGrantSchema>;

export type ProfessionalContextAssistantConnection = {
  id: string;
  clientId: string;
  assistantProvider: "chatgpt" | "claude" | "other";
};

export function activeProfessionalContextReadGrants(input: unknown, now = new Date()) {
  const parsed = professionalContextReadGrantEnvelopeSchema.parse(input);
  const nowMs = now.getTime();
  return parsed.grants.filter((grant) =>
    grant.status === "active"
    && Number.isFinite(Date.parse(grant.expires_at))
    && Date.parse(grant.expires_at) > nowMs
  );
}

export function assistantConnectionLabel(connection: ProfessionalContextAssistantConnection) {
  const provider = connection.assistantProvider === "chatgpt"
    ? "ChatGPT"
    : connection.assistantProvider === "claude"
      ? "Claude"
      : "AI assistant";
  const suffix = connection.clientId.slice(-8);
  return `${provider} connection · ${suffix}`;
}
