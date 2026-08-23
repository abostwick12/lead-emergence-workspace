import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, mcpUnauthorized, workspaceMcpResourceUri } from "@/lib/workspace/mcp-auth";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedOrigins = new Set(["https://chatgpt.com", "https://claude.ai", "https://www.claude.ai", "https://workspace.leademergence.com"]);

export async function POST(request: Request) {
  const resource = new URL(workspaceMcpResourceUri());
  if (process.env.NODE_ENV === "production" && new URL(request.url).host !== resource.host) {
    return Response.json({ error: "misdirected_request" }, { status: 421 });
  }
  const authenticated = await authenticateMcpRequest(request);
  if (!authenticated) return withCors(request, mcpUnauthorized());

  const registration = await authenticated.supabase.rpc("mcp_register_connection");
  if (registration.error) return withCors(request, mcpUnauthorized("This connection is disconnected, unavailable, or not included."));

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    const server = createWorkspaceMcpServer(authenticated.supabase);
    await server.connect(transport);
    return withCors(request, await transport.handleRequest(request));
  } catch (caught) {
    console.error("Workspace MCP request failed", { error_type: caught instanceof Error ? caught.name : "UnknownError" });
    return withCors(request, Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Workspace MCP could not process the request safely." }, id: null }, { status: 500 }));
  }
}

export function GET(request: Request) {
  return withCors(request, Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "This stateless Workspace connection accepts POST requests." }, id: null }, { status: 405, headers: { Allow: "POST" } }));
}

export function DELETE(request: Request) {
  return withCors(request, Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Disconnect this assistant from Workspace Settings." }, id: null }, { status: 405, headers: { Allow: "POST" } }));
}

export function OPTIONS(request: Request) {
  return withCors(request, new Response(null, { status: 204 }));
}

function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins.has(origin)) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID");
  response.headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate");
  response.headers.set("Vary", "Origin");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
