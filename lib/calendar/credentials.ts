import "server-only";

import postgres from "postgres";
import { decryptIntegrationValue, encryptIntegrationValue } from "@/lib/integrations/crypto";

export type CalendarAccountSlot = "personal" | "business";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertBinding(workspaceId: string, accountSlot: CalendarAccountSlot): void {
  if (!UUID_PATTERN.test(workspaceId) || !["personal", "business"].includes(accountSlot)) {
    throw new Error("Invalid Calendar credential binding.");
  }
}

export function calendarCredentialAAD(workspaceId: string, accountSlot: CalendarAccountSlot): string {
  assertBinding(workspaceId, accountSlot);
  return `${workspaceId.toLowerCase()}:calendar:${accountSlot}`;
}

export function encryptCalendarCredential(
  value: string,
  secret: string,
  workspaceId: string,
  accountSlot: CalendarAccountSlot
): string {
  return encryptIntegrationValue(value, secret, calendarCredentialAAD(workspaceId, accountSlot));
}

export function decryptCalendarCredential(
  ciphertext: string,
  secret: string,
  workspaceId: string,
  accountSlot: CalendarAccountSlot
): string {
  return decryptIntegrationValue(ciphertext, secret, calendarCredentialAAD(workspaceId, accountSlot));
}

/** Server-only exact-slot read. Callers must bind workspace and meeting type themselves. */
export async function readCalendarCredential(workspaceId: string, accountSlot: CalendarAccountSlot): Promise<string> {
  assertBinding(workspaceId, accountSlot);
  const databaseUrl = process.env.WORKSPACE_CALENDAR_READER_DB_URL?.trim();
  const secret = process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!databaseUrl || !secret || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("Calendar credential reader is not configured.");
  }

  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 3, idle_timeout: 1 });
  try {
    const [identity] = await sql<{ role: string }[]>`select current_user as role`;
    if (identity?.role !== "workspace_calendar_reader") {
      throw new Error("Calendar credential reader role mismatch.");
    }
    const [credential] = await sql<{ ciphertext: string; key_version: number }[]>`
      select ciphertext, key_version
        from workspace.read_calendar_credential(${workspaceId}::uuid, ${accountSlot}::text)
    `;
    if (!credential || credential.key_version !== 1) {
      throw new Error("Calendar credential is unavailable.");
    }
    return decryptCalendarCredential(credential.ciphertext, secret, workspaceId, accountSlot);
  } catch {
    throw new Error("Calendar credential is unavailable.");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Owner-facing status without returning ciphertext or a token to the browser. */
export async function calendarAccountConnected(workspaceId: string, accountSlot: CalendarAccountSlot): Promise<boolean> {
  assertBinding(workspaceId, accountSlot);
  const databaseUrl = process.env.WORKSPACE_CALENDAR_READER_DB_URL?.trim();
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("Calendar credential reader is not configured.");
  }
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 3, idle_timeout: 1 });
  try {
    const [identity] = await sql<{ role: string }[]>`select current_user as role`;
    if (identity?.role !== "workspace_calendar_reader") throw new Error("Calendar reader role mismatch.");
    const [record] = await sql<{ refresh_token_present: boolean }[]>`
      select refresh_token_present
        from workspace.read_calendar_credential(${workspaceId}::uuid, ${accountSlot}::text)
    `;
    return record?.refresh_token_present === true;
  } catch {
    throw new Error("Calendar connection status is unavailable.");
  } finally {
    await sql.end({ timeout: 1 });
  }
}
