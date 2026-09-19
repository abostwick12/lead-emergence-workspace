export const WORKSPACE_MCP_BINDING_VERSION = 1;

type CanonicalWorkspaceMcpClaimInput = {
  userId: string;
  resource: string;
  issuer: string;
  nowMs?: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCanonicalWorkspaceMcpClaims(
  claims: Record<string, unknown> | null,
  { userId, resource, issuer, nowMs = Date.now() }: CanonicalWorkspaceMcpClaimInput
) {
  if (!claims) return false;
  return claims.sub === userId
    && typeof claims.sub === "string"
    && uuidPattern.test(claims.sub)
    && claims.role === "authenticated"
    && claims.iss === issuer
    && claims.le_session_class === "mcp_oauth"
    && claims.le_product === "workspace"
    && claims.le_binding_version === WORKSPACE_MCP_BINDING_VERSION
    && claims.aud === resource
    && claims.resource === resource
    && claims.workspace_mcp === true
    && typeof claims.client_id === "string"
    && uuidPattern.test(claims.client_id)
    && typeof claims.session_id === "string"
    && uuidPattern.test(claims.session_id)
    && typeof claims.iat === "number"
    && Number.isFinite(claims.iat)
    && typeof claims.exp === "number"
    && Number.isFinite(claims.exp)
    && claims.exp * 1000 > nowMs;
}
