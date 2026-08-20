import { describe, expect, it } from "vitest";
import { DOMAIN_LABELS } from "@/lib/workspace/types";

describe("Workspace domains", () => {
  it("keeps the source command-center domains while adding generic and leadership work", () => {
    expect(DOMAIN_LABELS).toMatchObject({
      general: "General",
      military_transition: "Military transition",
      sotf_fellowship: "SOTF fellowship",
      job_search: "Job search",
      life: "Life",
      leadership: "Leadership"
    });
  });
});
