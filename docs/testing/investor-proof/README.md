# Investor native visual proof

Four inspected screenshots from the final isolated, optimized desktop/mobile
Investor browser run on 2026-09-09. Every record, account and research assertion
shown is fictional. No client research, credentials, traces or videos are included.

The fourteen-case Investor run passed on desktop Chrome and Pixel 7-emulated
Chrome in 4.3 minutes, with one worker and no retries. The HTML report records
fourteen expected and zero failed, flaky or skipped cases. Its last-run receipt reports
`passed` with no failed tests. Earlier, all sixty combined Investor, Nonprofit,
Ministry and Writer browser cases passed. See the P8 section of
[test evidence](../test-evidence.md) and
[the local proof runbook](../../runbooks/investor-local-proof.md).

- [Saved watchlist — desktop](watchlist-desktop.png)
- [Saved watchlist — mobile emulation](watchlist-mobile.png)
- [Sources and claim review state — desktop](evidence-desktop.png)
- [Sources and claim review state — mobile emulation](evidence-mobile.png)

Capture waits for the completed saved title, not a loading transition. The
confirmation label is measured at least 15 pixels by the browser tests. Compact
claims show both classification and review state; an unverified source or a
user-stated fact does not become independently verified by saving it.

These images demonstrate the exercised synthetic UI states, not a complete
accessibility audit, physical-device acceptance, live SEC success, installed
ChatGPT/Codex behavior, or measured client value. The actual public SEC attempt
was declined with HTTP 403 and no findings were inferred. All-six shipment
readiness remains NOT READY TO SHIP.
