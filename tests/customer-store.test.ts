import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StorePage from "@/app/workspace/store/page";
import { CUSTOMER_RELEASE_INDEX, CUSTOMER_RELEASE_SOURCE_REVISION } from "@/lib/workspace/customer-release-index";

describe("customer bundle Store", () => {
  it("uses the pinned customer release index and source revision", () => {
    expect(CUSTOMER_RELEASE_SOURCE_REVISION).toBe("b1c5ada91949877c3591128b406a01f8e1daf65e");
    expect(CUSTOMER_RELEASE_INDEX).toEqual({
      schemaVersion: "1.0",
      channel: "customer",
      approvedBundleManifests: []
    });
  });

  it("shows zero bundles for the empty customer allowlist", () => {
    const markup = renderToStaticMarkup(createElement(StorePage));
    expect(markup).toContain("No bundles are available yet");
    expect(markup).not.toContain("SOTF");
    expect(markup).not.toContain("Approved bundle");
  });
});
