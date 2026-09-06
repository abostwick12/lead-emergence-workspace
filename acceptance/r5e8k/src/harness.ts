import { EXPECTED_CALLBACK, type RunManifest, validateManifest } from "./manifest";
import {
  buildEmailChangeRequest,
  buildExchangeRequest,
  buildPasswordChangeRequest,
  buildRecoveryRequest,
  sendExactlyOnce,
  type ApprovedRequest,
} from "./request-contract";
import { HarnessStateMachine } from "./state-machine";
import {
  commitExchange,
  continuationKey,
  createContinuation,
  makeTerminalMarker,
  markRecoverySent,
  readRecord,
  replaceWithTerminal,
  validateContinuation,
  writeAndVerify,
  type ContinuationRecord,
  type TerminalReason,
} from "./storage-lifecycle";
import { verifyRecoveryAccessToken } from "./jwt-validator";

declare const __R5E8K_MANIFEST__: RunManifest;

type TokenPayload = Record<string, unknown> & {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  user?: unknown;
};

interface ParsedTokenResponse {
  accessToken: string;
  expiresIn: unknown;
  expiresAt: unknown;
}

const REQUEST_TIMEOUT_MS = 30000;

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!(value instanceof HTMLElement)) throw new Error("required UI element missing");
  return value as T;
}

function parseTokenResponse(payload: TokenPayload): ParsedTokenResponse {
  if (
    typeof payload.access_token !== "string" ||
    payload.access_token.length < 32 ||
    typeof payload.refresh_token !== "string" ||
    payload.refresh_token.length < 16 ||
    payload.token_type !== "bearer"
  ) {
    throw new Error("malformed token response");
  }
  const accessToken = payload.access_token;
  const expiresIn = payload.expires_in;
  const expiresAt = payload.expires_at;
  payload.access_token = "";
  payload.refresh_token = "";
  payload.user = null;
  return { accessToken, expiresIn, expiresAt };
}

function parseUserResponse(payload: unknown, manifest: RunManifest, expectPendingEmail: boolean): void {
  if (payload === null || typeof payload !== "object") throw new Error("malformed user response");
  const user = payload as Record<string, unknown>;
  if (user.id !== manifest.fixture.subject || user.email !== manifest.fixture.currentEmail) {
    throw new Error("user response fixture mismatch");
  }
  if (expectPendingEmail && user.new_email !== manifest.fixture.newEmail) {
    throw new Error("pending email response mismatch");
  }
}

function captureAndScrubCallback(): { code: string | null; invalid: boolean } {
  const search = window.location.search;
  const fragmentPresent = window.location.hash.length > 0;
  let code: string | null = null;
  let invalid = fragmentPresent;
  if (search.length > 0) {
    const parameters = new URLSearchParams(search);
    const values = parameters.getAll("code");
    if ([...parameters.keys()].some((key) => key !== "code") || values.length !== 1 || !/^[0-9a-f-]{36}$/iu.test(values[0]!)) {
      invalid = true;
    } else {
      code = values[0]!;
    }
  }
  if (search.length > 0 || fragmentPresent) {
    history.replaceState(null, "", new URL(EXPECTED_CALLBACK).pathname);
  }
  return { code, invalid };
}

async function fetchWithTerminalTimeout(manifest: RunManifest, request: ApprovedRequest): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await sendExactlyOnce(
      (input, init) => fetch(input, { ...init, signal: controller.signal }),
      manifest,
      request,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function bootHarness(manifest: RunManifest = __R5E8K_MANIFEST__): Promise<void> {
  const callback = captureAndScrubCallback();
  const machine = new HarnessStateMachine();
  const status = element<HTMLParagraphElement>("status");
  const sendButton = element<HTMLButtonElement>("send-recovery");
  const recoveryEvidenceButton = element<HTMLButtonElement>("recovery-evidence");
  const emailButton = element<HTMLButtonElement>("request-email-change");
  const pendingEvidenceButton = element<HTMLButtonElement>("pending-evidence");
  const passwordInput = element<HTMLInputElement>("new-password");
  const passwordButton = element<HTMLButtonElement>("update-password");
  const allControls = [sendButton, recoveryEvidenceButton, emailButton, pendingEvidenceButton, passwordInput, passwordButton];
  const setControls = (enabled?: HTMLElement): void => {
    for (const control of allControls) {
      if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) control.disabled = control !== enabled;
      control.hidden = control !== enabled;
    }
  };

  let accessToken = "";
  let actionDeadlineEpochMs = 0;
  let transactionBindingSha256 = "0".repeat(64);
  let channel: BroadcastChannel | null = null;
  const storageKey = continuationKey(manifest);

  const clearCredentials = (): void => {
    accessToken = "";
    actionDeadlineEpochMs = 0;
    passwordInput.value = "";
  };

  const render = (message: string, control?: HTMLElement): void => {
    status.textContent = message;
    setControls(control);
  };

  const persistTerminal = (reason: TerminalReason): void => {
    try {
      replaceWithTerminal(sessionStorage, storageKey, manifest, transactionBindingSha256, reason, Date.now());
    } catch {
      // The in-memory terminal state still prevents activity. The ceremony requires immediate profile destruction.
    }
  };

  const terminate = (reason: TerminalReason, uncertain = false): void => {
    clearCredentials();
    machine.terminate(uncertain);
    persistTerminal(reason);
    render(`C-HARNESS STOP — ${reason}`);
    channel?.close();
    channel = null;
  };

  const requireLiveWindow = (): void => {
    const now = Date.now();
    if (now < manifest.timing.notBeforeEpochMs || now >= manifest.timing.artifactHardStopEpochMs) {
      throw new Error("artifact expired");
    }
    if (actionDeadlineEpochMs !== 0 && now >= actionDeadlineEpochMs) throw new Error("action window expired");
  };

  const performRequest = async (request: ApprovedRequest): Promise<Response> => {
    requireLiveWindow();
    return fetchWithTerminalTimeout(manifest, request);
  };

  window.addEventListener(
    "error",
    (event) => {
      event.preventDefault();
      terminate("MUTATION_UNCERTAIN", true);
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    terminate("MUTATION_UNCERTAIN", true);
  });
  window.addEventListener("pagehide", () => {
    if (machine.state === "EXCHANGE_COMMITTED") {
      terminate("EXCHANGE_UNCERTAIN", true);
    } else if (machine.state === "EMAIL_CHANGE_COMMITTED" || machine.state === "PASSWORD_COMMITTED") {
      terminate("MUTATION_UNCERTAIN", true);
    } else if (accessToken.length > 0) {
      // The exchange is already irreversibly consumed. Leaving discards the
      // closure-held token but does not manufacture mutation uncertainty.
      terminate("EXCHANGE_COMMITTED");
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && machine.state !== "READY_TO_SEND") terminate("INVALID_CALLBACK");
    if (Date.now() >= manifest.timing.artifactHardStopEpochMs) terminate("EXPIRED");
  });

  try {
    if (window.location.origin !== new URL(EXPECTED_CALLBACK).origin || window.location.pathname !== new URL(EXPECTED_CALLBACK).pathname) {
      throw new Error("origin or path substitution");
    }
    await validateManifest(manifest, Date.now());
    if (window.opener !== null) throw new Error("opener is not permitted");
    if (callback.invalid) {
      terminate("INVALID_CALLBACK");
      return;
    }
    if ("serviceWorker" in navigator && (await navigator.serviceWorker.getRegistrations()).length !== 0) {
      throw new Error("service worker controls profile");
    }
    if ("caches" in window && (await caches.keys()).length !== 0) throw new Error("browser cache is not empty");

    if (typeof BroadcastChannel !== "undefined") {
      const contextId = crypto.randomUUID();
      channel = new BroadcastChannel(`r5e8c.${manifest.manifestCoreSha256}`);
      channel.addEventListener("message", (event: MessageEvent<{ contextId?: string }>) => {
        if (event.data?.contextId !== contextId) {
          channel?.postMessage({ contextId });
          terminate("DUPLICATE_CONTEXT");
        }
      });
      channel.postMessage({ contextId });
    }

    const stored = readRecord(sessionStorage, storageKey);
    if (stored?.kind === "terminal") {
      render(`C-HARNESS STOP — ${stored.terminalReason}`);
      machine.terminate(stored.terminalReason === "EXCHANGE_UNCERTAIN" || stored.terminalReason === "MUTATION_UNCERTAIN");
      return;
    }

    if (callback.code !== null) {
      if (stored?.kind !== "continuation") {
        terminate("INVALID_CALLBACK");
        return;
      }
      validateContinuation(stored, manifest, Date.now());
      transactionBindingSha256 = stored.transactionBindingSha256;
      machine.transition("CALLBACK_ACCEPTED");
      machine.transition("EXCHANGE_PREPARE");
      const authority = commitExchange(sessionStorage, storageKey, stored, manifest, callback.code, Date.now());
      callback.code = null;
      machine.transition("EXCHANGE_COMMITTED");
      const exchangeRequest = buildExchangeRequest(manifest, authority.authCode, authority.codeVerifier);
      let response: Response;
      try {
        response = await performRequest(exchangeRequest);
      } catch {
        authority.authCode = "";
        authority.codeVerifier = "";
        terminate("EXCHANGE_UNCERTAIN", true);
        return;
      }
      authority.authCode = "";
      authority.codeVerifier = "";
      if (!response.ok) {
        terminate("EXCHANGE_REJECTED");
        return;
      }
      let parsed: ParsedTokenResponse | null = null;
      try {
        const payload = (await response.json()) as TokenPayload;
        parsed = parseTokenResponse(payload);
        const verified = await verifyRecoveryAccessToken(parsed.accessToken, manifest, Date.now(), {
          expiresIn: parsed.expiresIn,
          expiresAt: parsed.expiresAt,
        });
        accessToken = verified.accessToken;
        actionDeadlineEpochMs = verified.actionDeadlineEpochMs;
        parsed.accessToken = "";
      } catch {
        if (parsed !== null) parsed.accessToken = "";
        terminate("WRONG_FIXTURE");
        return;
      }
      machine.transition("RECOVERY_VALIDATED");
      machine.transition("RECOVERY_EVIDENCE_PAUSE");
      render("Return only: C-PKCE-RECOVERY COMPLETE", recoveryEvidenceButton);
    } else {
      if (stored !== null) {
        terminate(stored.kind === "continuation" && Date.now() >= stored.absoluteExpiryEpochMs ? "EXPIRED" : "INVALID_CALLBACK");
        return;
      }
      machine.transition("READY_TO_SEND");
      render("Fixture C — send the approved recovery message once.", sendButton);
    }
  } catch {
    terminate("INVALID_CALLBACK");
    return;
  }

  sendButton.addEventListener(
    "click",
    () => {
      void (async () => {
        if (machine.state !== "READY_TO_SEND") return;
        sendButton.disabled = true;
        setControls();
        machine.transition("RECOVERY_SEND_LATCHED");
        let continuation: ContinuationRecord | null = null;
        try {
          requireLiveWindow();
          continuation = await createContinuation(manifest, Date.now());
          transactionBindingSha256 = continuation.transactionBindingSha256;
          writeAndVerify(sessionStorage, storageKey, continuation);
          const response = await performRequest(buildRecoveryRequest(manifest, continuation.codeChallenge));
          if (!response.ok || response.status === 429) {
            replaceWithTerminal(sessionStorage, storageKey, manifest, transactionBindingSha256, "RECOVERY_REQUEST_UNCERTAIN", Date.now());
            terminate("RECOVERY_REQUEST_UNCERTAIN", true);
            return;
          }
          const body = (await response.json()) as unknown;
          if (body === null || typeof body !== "object" || Object.keys(body).length !== 0) {
            terminate("RECOVERY_REQUEST_UNCERTAIN", true);
            return;
          }
          continuation = markRecoverySent(sessionStorage, storageKey, continuation);
          machine.transition("RECOVERY_SENT");
          render(
            "Fixture C recovery requested. In this same tab, open the controlled mailbox and follow the newest approved recovery action. Do not copy the link or open another tab.",
          );
        } catch {
          if (continuation !== null) {
            continuation.codeVerifier = "";
            continuation.codeChallenge = "";
            continuation.transactionNonce = "";
          }
          terminate("RECOVERY_REQUEST_UNCERTAIN", true);
        }
      })();
    },
    { once: true },
  );

  recoveryEvidenceButton.addEventListener(
    "click",
    () => {
      try {
        requireLiveWindow();
        if (machine.state !== "RECOVERY_EVIDENCE_PAUSE" || accessToken.length === 0) throw new Error("invalid evidence resume");
        machine.transition("EMAIL_CHANGE_READY");
        render("Recovery evidence cleared. Request the fixed Fixture C email change once.", emailButton);
      } catch {
        terminate("EXPIRED");
      }
    },
    { once: true },
  );

  emailButton.addEventListener(
    "click",
    () => {
      void (async () => {
        if (machine.state !== "EMAIL_CHANGE_READY") return;
        emailButton.disabled = true;
        setControls();
        machine.transition("EMAIL_CHANGE_COMMITTED");
        try {
          const response = await performRequest(buildEmailChangeRequest(manifest, accessToken));
          if (!response.ok || response.status === 429) {
            terminate("MUTATION_UNCERTAIN", true);
            return;
          }
          parseUserResponse(await response.json(), manifest, true);
          machine.transition("PENDING_EMAIL_EVIDENCE_PAUSE");
          render("Return only: C-EMAIL-CHANGE REQUESTED", pendingEvidenceButton);
        } catch {
          terminate("MUTATION_UNCERTAIN", true);
        }
      })();
    },
    { once: true },
  );

  pendingEvidenceButton.addEventListener(
    "click",
    () => {
      try {
        requireLiveWindow();
        if (machine.state !== "PENDING_EMAIL_EVIDENCE_PAUSE" || accessToken.length === 0) throw new Error("invalid evidence resume");
        machine.transition("PASSWORD_READY");
        passwordInput.hidden = false;
        passwordInput.disabled = false;
        passwordButton.hidden = false;
        passwordButton.disabled = false;
        status.textContent = "Pending-email evidence cleared. Enter the private Fixture C replacement password.";
        passwordInput.focus();
      } catch {
        terminate("EXPIRED");
      }
    },
    { once: true },
  );

  passwordButton.addEventListener(
    "click",
    () => {
      void (async () => {
        if (machine.state !== "PASSWORD_READY") return;
        passwordButton.disabled = true;
        passwordInput.disabled = true;
        const password = passwordInput.value;
        passwordInput.value = "";
        setControls();
        machine.transition("PASSWORD_COMMITTED");
        try {
          const request = buildPasswordChangeRequest(manifest, accessToken, password);
          const response = await performRequest(request);
          if (!response.ok || response.status === 429) {
            terminate("MUTATION_UNCERTAIN", true);
            return;
          }
          parseUserResponse(await response.json(), manifest, false);
          clearCredentials();
          machine.transition("COMPLETE");
          writeAndVerify(
            sessionStorage,
            storageKey,
            makeTerminalMarker(manifest, transactionBindingSha256, "COMPLETE", Date.now()),
          );
          render("Return only: C-PASSWORD COMPLETE");
          channel?.close();
          channel = null;
        } catch {
          terminate("MUTATION_UNCERTAIN", true);
        }
      })();
    },
    { once: true },
  );

  window.setInterval(() => {
    if (
      !machine.isTerminal &&
      (Date.now() >= manifest.timing.artifactHardStopEpochMs ||
        (actionDeadlineEpochMs !== 0 && Date.now() >= actionDeadlineEpochMs))
    ) {
      terminate("EXPIRED");
    }
  }, 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void bootHarness();
}
