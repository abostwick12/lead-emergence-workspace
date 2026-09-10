import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace/bundle-server", () => {
  class BundleApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
  return {
    BundleApiError,
    readBearerToken(request: Request) { const value = request.headers.get("authorization"); if (!value?.startsWith("Bearer ")) throw new BundleApiError("Sign in before managing a bundle.", 401); return value.slice(7); },
    authenticatedBundleClient: vi.fn(async () => ({ client: { rpc: state.rpc }, user: { id: "19111111-1111-4111-8111-111111111111" } }))
  };
});
import { POST } from "@/app/api/source-intake/extract/route";

function request(file = new File(["Fictional source text"], "source.txt", { type: "text/plain" }), extra?: [string, string]) {
  const form = new FormData(); form.set("purpose", "writer_resource"); form.set("file", file); if (extra) form.set(...extra);
  return new Request("http://localhost/api/source-intake/extract", { method: "POST", headers: { Authorization: "Bearer synthetic" }, body: form });
}

describe("source intake HTTP boundary", () => {
  beforeEach(() => state.rpc.mockReset().mockResolvedValue({ data: { purpose: "writer_resource" }, error: null }));

  it("authorizes the fixed purpose before returning a non-retained extraction", async () => {
    const response = await POST(request()), body = await response.json();
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("authorize_source_intake", { p_purpose: "writer_resource" });
    expect(body).toMatchObject({ text: "Fictional source text", originalRetained: false, file: { name: "source.txt", format: "plain_text" } });
    expect(response.headers.get("cache-control")).toBe("no-store, private");
  });

  it("preserves Chrome-style mixed-case multipart boundaries while parsing", async () => {
    const boundary = "----WebKitFormBoundaryP19Case";
    const body = [`--${boundary}`, `Content-Disposition: form-data; name="purpose"`, "", "writer_resource",
      `--${boundary}`, `Content-Disposition: form-data; name="file"; filename="source.txt"`, "Content-Type: text/plain", "", "Fictional source text", `--${boundary}--`, ""].join("\r\n");
    const response = await POST(new Request("http://localhost/api/source-intake/extract", { method: "POST",
      headers: { Authorization: "Bearer synthetic", "Content-Type": `multipart/form-data; boundary=${boundary}` }, body }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ text: "Fictional source text", originalRetained: false });
  });

  it("rejects extra multipart fields and mismatched file signatures", async () => {
    expect((await POST(request(undefined, ["workspaceId", crypto.randomUUID()]))).status).toBe(400);
    const bad = await POST(request(new File(["not a PDF"], "source.pdf", { type: "application/pdf" })));
    expect(bad.status).toBe(415);
    expect((await bad.json()).message).not.toMatch(/stack|pdfjs|syntax/i);
  });

  it("rejects missing bearer, wrong content type and declared oversized requests", async () => {
    const noBearer = new Request("http://localhost/api/source-intake/extract", { method: "POST", body: new FormData() });
    expect((await POST(noBearer)).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/source-intake/extract", { method: "POST", headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" }, body: "{}" }))).status).toBe(415);
    const oversized = request(); oversized.headers.set("Content-Length", "5000000");
    expect((await POST(oversized)).status).toBe(413);
  });

  it("returns the authorization denial without parsing it into a success", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Writer source intake is unavailable." } });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Writer source intake is unavailable." });
  });
});
