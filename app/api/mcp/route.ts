import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, mcpUnauthorized, workspaceMcpResourceUri } from "@/lib/workspace/mcp-auth";
import { isMcpCorsOrigin, isMcpRequestOriginAllowed } from "@/lib/workspace/mcp-origin";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

// Streamable HTTP clients may open the optional server-sent-events channel
// before they send their first JSON-RPC request. Returning a plain 405 here
// makes otherwise valid ChatGPT/Claude connectors report "action discovery
// failed" even though POST is healthy.
export async function GET(request: Request) {
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request) {
  if (!isMcpRequestOriginAllowed(request.headers.get("origin"))) return mcpOriginForbidden(request);
  const resource = new URL(workspaceMcpResourceUri());
  if (process.env.NODE_ENV === "production" && new URL(request.url).host !== resource.host) {
    return Response.json({ error: "misdirected_request" }, { status: 421 });
  }
  const authenticated = await authenticateMcpRequest(request);
  if (!authenticated) return withCors(request, mcpUnauthorized());

  const registration = await authenticated.supabase.rpc("mcp_register_connection");
  if (registration.error) return withCors(request, mcpUnauthorized("This connection is disconnected, unavailable, or not included."));

  try {
    // Vercel functions do not retain an in-memory transport between requests.
    // Keep the endpoint explicitly stateless so clients can complete
    // initialize -> tools/list across separate function invocations.
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createWorkspaceMcpServer(authenticated.supabase);
    await server.connect(transport);
    return withCors(request, await transport.handleRequest(request));
  } catch (caught) {
    console.error("Workspace MCP request failed", { error_type: caught instanceof Error ? caught.name : "UnknownError" });
    return withCors(request, Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Workspace MCP could not process the request safely." }, id: null }, { status: 500 }));
  }
}

export function DELETE(request: Request) {
  if (!isMcpRequestOriginAllowed(request.headers.get("origin"))) return mcpOriginForbidden(request);
  return withCors(request, Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Disconnect this assistant from Workspace Settings." }, id: null }, { status: 405, headers: { Allow: "POST" } }));
}

export function OPTIONS(request: Request) {
  if (!isMcpRequestOriginAllowed(request.headers.get("origin"))) return mcpOriginForbidden(request);
  return withCors(request, new Response(null, { status: 204 }));
}

function mcpOriginForbidden(request: Request) {
  return withCors(request, Response.json({ error: "origin_not_allowed" }, { status: 403 }));
}

function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (isMcpCorsOrigin(origin)) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID");
  response.headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate");
  response.headers.set("Vary", "Origin");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
