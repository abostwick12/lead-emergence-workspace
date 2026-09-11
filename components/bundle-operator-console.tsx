"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Link2, LoaderCircle, RefreshCw, Search, ShieldCheck, Trash2, UserRoundCheck } from "lucide-react";
import { getWorkspaceClient } from "@/lib/supabase/client";
import type { BundleOperatorCatalogItem, BundleOperatorState } from "@/lib/workspace/bundle-contract";
import styles from "./bundle-operator-console.module.css";

type Feedback = { kind: "success" | "error"; message: string } | null;
type IssuedInvite = { inviteId: string; inviteUrl: string; bundleName: string; recipientEmail: string } | null;

function newRequestKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function accessToken() {
  const { data, error } = await getWorkspaceClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in again before managing bundle access.");
  return data.session.access_token;
}

async function operatorRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${await accessToken()}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "The bundle operation could not be completed.");
  return payload;
}

function stateLabel(state: BundleOperatorCatalogItem["state"]) {
  return state === "active" ? "Active" : state === "expired" ? "Expired" : state === "revoked" ? "Removed" : "Not granted";
}

function sourceLabel(source: BundleOperatorCatalogItem["source"]) {
  if (!source) return null;
  return {
    operator_assignment: "Direct grant",
    invite: "Claimed invite",
    subscription: "Subscription",
    promotion: "Promotion",
    organization_license: "Organization license"
  }[source];
}

function formatDate(value: string | null) {
  if (!value) return "No expiration";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function BundleOperatorConsole() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [state, setState] = useState<BundleOperatorState | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [invite, setInvite] = useState<IssuedInvite>(null);
  const [busy, setBusy] = useState<string | null>("catalog");

  async function loadState(targetWorkspaceId?: string) {
    const query = targetWorkspaceId ? `?workspaceId=${encodeURIComponent(targetWorkspaceId)}` : "";
    const payload = await operatorRequest<{ state: BundleOperatorState }>(`/api/operator/bundles/state${query}`);
    setState(payload.state);
    return payload.state;
  }

  useEffect(() => {
    let active = true;
    operatorRequest<{ state: BundleOperatorState }>("/api/operator/bundles/state")
      .then((payload) => { if (active) setState(payload.state); })
      .catch((error: unknown) => {
        if (active) setFeedback({ kind: "error", message: error instanceof Error ? error.message : "The bundle catalog could not be loaded." });
      })
      .finally(() => { if (active) setBusy(null); });
    return () => { active = false; };
  }, []);

  async function reviewWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = workspaceId.trim();
    setBusy("review");
    setFeedback(null);
    setInvite(null);
    try {
      const nextState = await loadState(normalizedId);
      setFeedback({ kind: "success", message: `${nextState.workspace?.ownerDisplayName ?? "Client"} is verified. Review access below before making changes.` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "This workspace could not be reviewed." });
    } finally {
      setBusy(null);
    }
  }

  async function grantBundle(bundle: BundleOperatorCatalogItem) {
    if (!state?.workspace) return;
    setBusy(`grant-${bundle.bundleKey}`);
    setFeedback(null);
    try {
      await operatorRequest("/api/operator/bundles/assign", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: state.workspace.workspaceId,
          bundleKey: bundle.bundleKey,
          idempotencyKey: newRequestKey("assignment"),
          expiresAt: null
        })
      });
      await loadState(state.workspace.workspaceId);
      setFeedback({ kind: "success", message: `${bundle.displayName} is now active for ${state.workspace.ownerDisplayName}.` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "This bundle could not be granted." });
    } finally {
      setBusy(null);
    }
  }

  async function removeBundle(event: FormEvent<HTMLFormElement>, bundle: BundleOperatorCatalogItem) {
    event.preventDefault();
    if (!state?.workspace || !bundle.entitlementId) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") || "");
    setBusy(`remove-${bundle.bundleKey}`);
    setFeedback(null);
    try {
      await operatorRequest("/api/operator/bundles/entitlements/revoke", {
        method: "POST",
        body: JSON.stringify({ entitlementId: bundle.entitlementId, reason })
      });
      await loadState(state.workspace.workspaceId);
      setFeedback({ kind: "success", message: `${bundle.displayName} access was removed. The reason is preserved in the audit history.` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "This bundle could not be removed." });
    } finally {
      setBusy(null);
    }
  }

  async function issueInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const bundleKey = String(form.get("bundleKey") || "");
    const recipientEmail = String(form.get("recipientEmail") || "");
    const bundleName = state?.bundles.find((bundle) => bundle.bundleKey === bundleKey)?.displayName || "Bundle";
    setBusy("invite");
    setFeedback(null);
    setInvite(null);
    try {
      const payload = await operatorRequest<{ invite: { invite_id: string }; inviteUrl: string }>("/api/operator/bundles/invites", {
        method: "POST",
        body: JSON.stringify({ recipientEmail, bundleKey, idempotencyKey: newRequestKey("invite"), expiresAt: null })
      });
      setInvite({ inviteId: payload.invite.invite_id, inviteUrl: payload.inviteUrl, bundleName, recipientEmail });
      setFeedback({ kind: "success", message: "Invite ready. Share the single-use link with the intended recipient." });
      formElement.reset();
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "This invite could not be issued." });
    } finally {
      setBusy(null);
    }
  }

  async function withdrawInvite() {
    if (!invite) return;
    setBusy("withdraw-invite");
    setFeedback(null);
    try {
      await operatorRequest("/api/operator/bundles/invites/revoke", {
        method: "POST",
        body: JSON.stringify({ inviteId: invite.inviteId, reason: "Invite withdrawn from the client access console." })
      });
      setInvite(null);
      setFeedback({ kind: "success", message: "The invite was withdrawn and can no longer be claimed." });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "This invite could not be withdrawn." });
    } finally {
      setBusy(null);
    }
  }

  async function copyInviteLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setFeedback({ kind: "success", message: "Invite link copied." });
    } catch {
      setFeedback({ kind: "error", message: "Copy was unavailable. Select and copy the visible link instead." });
    }
  }

  async function refreshReviewedState() {
    if (!state?.workspace) return;
    setBusy("refresh");
    setFeedback(null);
    try {
      await loadState(state.workspace.workspaceId);
      setFeedback({ kind: "success", message: "Client access is up to date." });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Client access could not be refreshed." });
    } finally {
      setBusy(null);
    }
  }

  const reviewed = state?.workspace ?? null;
  const loading = busy !== null;

  return <div className={styles.console}>
    <section className={styles.reviewPanel} aria-labelledby="client-review-heading">
      <div className={styles.sectionHeading}>
        <div className={styles.icon}><Search size={19} aria-hidden="true" /></div>
        <div>
          <p className={`${styles.eyebrow} eyebrow`}>Step 1 · Verify the client</p>
          <h2 id="client-review-heading">Review a Personal Workspace</h2>
          <p>Access changes stay locked until the workspace and its active owner are verified.</p>
        </div>
      </div>
      <form className={styles.reviewForm} onSubmit={reviewWorkspace}>
        <label className={styles.field}>
          <span>Workspace ID</span>
          <input
            name="workspaceId"
            type="text"
            required
            pattern="[0-9a-fA-F-]{36}"
            autoComplete="off"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              if (reviewed && event.target.value.trim() !== reviewed.workspaceId) {
                setState((current) => current ? {
                  ...current,
                  workspace: null,
                  bundles: current.bundles.map((bundle) => ({
                    ...bundle,
                    state: "available",
                    entitlementId: null,
                    source: null,
                    startsAt: null,
                    expiresAt: null,
                    revokedAt: null,
                    revocationReason: null
                  }))
                } : current);
                setInvite(null);
                setFeedback(null);
              }
            }}
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          {busy === "review" ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <UserRoundCheck size={17} aria-hidden="true" />}
          {busy === "review" ? "Reviewing…" : "Review client"}
        </button>
      </form>
      {reviewed ? <div className={styles.identity} aria-label="Verified client workspace">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <strong>{reviewed.ownerDisplayName}</strong>
          <span>{reviewed.ownerEmail || "No email on account"}</span>
        </div>
        <div>
          <strong>{reviewed.workspaceName}</strong>
          <span className={styles.mono}>{reviewed.workspaceId}</span>
        </div>
        <span className={styles.verified}><Check size={14} aria-hidden="true" /> Verified owner</span>
      </div> : null}
    </section>

    {feedback ? <div className={feedback.kind === "error" ? "error" : "notice"} role="status"><p>{feedback.message}</p></div> : null}

    <section className={styles.accessSection} aria-labelledby="bundle-access-heading" aria-busy={busy === "catalog"}>
      <div className={styles.sectionHeading}>
        <div className={styles.icon}><KeyRound size={19} aria-hidden="true" /></div>
        <div>
          <p className={`${styles.eyebrow} eyebrow`}>Step 2 · Set access</p>
          <h2 id="bundle-access-heading">Bundle access</h2>
          <p>{reviewed ? `Grant or remove each bundle for ${reviewed.ownerDisplayName}.` : "Review a client to unlock grants and removals."}</p>
        </div>
      </div>
      {busy === "catalog" ? <p className={styles.loading}><LoaderCircle className={styles.spin} size={18} aria-hidden="true" /> Loading the bundle catalog…</p> : null}
      <div className={styles.bundleGrid}>
        {state?.bundles.map((bundle) => <article className={styles.bundleCard} key={bundle.bundleKey} aria-label={`${bundle.displayName} access`}>
          <div className={styles.bundleTopline}>
            <span className={`${styles.status} ${styles[bundle.state]}`}>{stateLabel(bundle.state)}</span>
            <span>{bundle.capabilityCount} {bundle.capabilityCount === 1 ? "capability" : "capabilities"}</span>
          </div>
          <div>
            <h3>{bundle.displayName}</h3>
            <p>{bundle.description}</p>
          </div>
          {bundle.state === "active" ? <dl className={styles.accessMeta}>
            <div><dt>Source</dt><dd>{sourceLabel(bundle.source)}</dd></div>
            <div><dt>Expiration</dt><dd>{formatDate(bundle.expiresAt)}</dd></div>
          </dl> : bundle.state === "revoked" && bundle.revocationReason ? <p className={styles.auditNote}>Last removal: {bundle.revocationReason}</p> : null}
          <div className={styles.cardAction}>
            {bundle.state === "active" ? <details>
              <summary>Remove access</summary>
              <form onSubmit={(event) => removeBundle(event, bundle)}>
                <label className={styles.field}>
                  <span>Audit reason</span>
                  <textarea name="reason" required minLength={5} maxLength={500} rows={3} placeholder="Why is access being removed?" />
                </label>
                <button className="button danger" type="submit" disabled={loading}>
                  {busy === `remove-${bundle.bundleKey}` ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
                  Confirm removal
                </button>
              </form>
            </details> : <button className="button" type="button" disabled={!reviewed || loading} onClick={() => grantBundle(bundle)}>
              {busy === `grant-${bundle.bundleKey}` ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              {bundle.state === "available" ? "Grant bundle" : "Grant again"}
            </button>}
          </div>
        </article>)}
      </div>
    </section>

    <section className={styles.invitePanel} aria-labelledby="bundle-invite-heading">
      <div className={styles.sectionHeading}>
        <div className={styles.icon}><Link2 size={19} aria-hidden="true" /></div>
        <div>
          <p className={`${styles.eyebrow} eyebrow`}>Alternative · Send an invite</p>
          <h2 id="bundle-invite-heading">Invite a client to claim one bundle</h2>
          <p>The signed-in email must match. Unclaimed links expire after seven days and can be withdrawn here.</p>
        </div>
      </div>
      <form className={styles.inviteForm} onSubmit={issueInvite}>
        <label className={styles.field}>
          <span>Bundle</span>
          <select name="bundleKey" required defaultValue="" aria-label="Bundle">
            <option value="" disabled>Select a bundle</option>
            {state?.bundles.map((bundle) => <option key={bundle.bundleKey} value={bundle.bundleKey}>{bundle.displayName}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Recipient email</span>
          <input name="recipientEmail" type="email" required autoComplete="email" placeholder="client@example.com" />
        </label>
        <button className="button" type="submit" disabled={loading || !state?.bundles.length}>
          {busy === "invite" ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
          {busy === "invite" ? "Creating…" : "Create invite"}
        </button>
      </form>
      {invite ? <div className={styles.inviteResult}>
        <div>
          <strong>{invite.bundleName} invite</strong>
          <span>For {invite.recipientEmail}</span>
        </div>
        <a href={invite.inviteUrl}>{invite.inviteUrl}</a>
        <div className={styles.inviteActions}>
          <button className="button secondary" type="button" onClick={copyInviteLink}>
            <Copy size={16} aria-hidden="true" /> Copy link
          </button>
          <button className="button danger" type="button" disabled={loading} onClick={withdrawInvite}>
            {busy === "withdraw-invite" ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            Withdraw invite
          </button>
        </div>
      </div> : null}
    </section>

    {reviewed ? <button className={`${styles.refresh} button secondary`} type="button" disabled={loading} onClick={refreshReviewedState}>
      {busy === "refresh" ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />} Refresh access
    </button> : null}
  </div>;
}
