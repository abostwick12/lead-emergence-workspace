/** Product-facing contract only. The separate security workstream owns its implementation. */
export interface ProtectedContextPort {
  retrieve(request: { purpose: "opportunity" | "story" | "meeting" | "coaching"; query: string }): Promise<
    | { status: "unavailable"; message: string }
    | { status: "available"; references: Array<{ referenceId: string; approvedExcerpt: string; purpose: string }> }
  >;
}

/** No protected read, write, grant, or local persistence is attempted by this adapter. */
export const unavailableProtectedContext: ProtectedContextPort = {
  async retrieve() {
    return { status: "unavailable", message: "Protected Professional Context is not connected to this pilot. Continue with ordinary information explicitly supplied for this workflow, or return after the separately approved capability becomes available. Do not copy private or sensitive context into operational notes." };
  }
};
