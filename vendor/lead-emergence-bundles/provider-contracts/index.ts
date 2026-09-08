import { z } from "zod";

export const providerOperationSchema = z.enum(["read", "propose", "execute"]);

export const providerRequirementSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9._-]{2,99}$/),
  provider: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  required: z.boolean(),
  authorization: z.object({
    required: z.boolean(),
    method: z.enum(["oauth2", "managed_connection", "public"])
  }).strict(),
  scopes: z.array(z.string().trim().min(1).max(200)),
  operations: z.array(providerOperationSchema).min(1),
  dataBoundary: z.string().trim().min(1).max(500)
}).strict().superRefine((value, context) => {
  if (!value.authorization.required && value.authorization.method !== "public") {
    context.addIssue({
      code: "custom",
      message: "Only public providers may omit authorization"
    });
  }
  if (value.authorization.required && value.authorization.method === "public") {
    context.addIssue({
      code: "custom",
      message: "Public provider mode cannot claim account authorization"
    });
  }
});

export const providerConnectionSchema = z.object({
  provider: z.string(),
  status: z.enum(["connected", "expired", "revoked", "unavailable"]),
  grantedScopes: z.array(z.string()),
  authorizedSubjectId: z.string().uuid().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional()
}).strict();

export type ProviderOperation = z.infer<typeof providerOperationSchema>;
export type ProviderRequirement = z.infer<typeof providerRequirementSchema>;
export type ProviderConnection = z.infer<typeof providerConnectionSchema>;

export class ProviderAuthorizationError extends Error {
  readonly code = "PROVIDER_AUTHORIZATION_DENIED";
}

export function assertProviderAuthorized(
  requirementInput: ProviderRequirement,
  connectionInput: ProviderConnection | undefined,
  operation: ProviderOperation,
  subjectId: string,
  now = new Date()
): void {
  const requirement = providerRequirementSchema.parse(requirementInput);
  if (!requirement.operations.includes(operation)) {
    throw new ProviderAuthorizationError(`${requirement.provider} does not permit ${operation}.`);
  }
  if (!requirement.authorization.required) return;
  if (!connectionInput) throw new ProviderAuthorizationError(`${requirement.provider} is not connected.`);
  const connection = providerConnectionSchema.parse(connectionInput);
  const expired = connection.expiresAt ? new Date(connection.expiresAt) <= now : false;
  if (
    connection.provider !== requirement.provider
    || connection.status !== "connected"
    || expired
    || connection.authorizedSubjectId !== subjectId
  ) {
    throw new ProviderAuthorizationError(`${requirement.provider} authorization is unavailable or revoked.`);
  }
  const missingScope = requirement.scopes.find((scope) => !connection.grantedScopes.includes(scope));
  if (missingScope) throw new ProviderAuthorizationError(`${requirement.provider} is missing required scope ${missingScope}.`);
}
