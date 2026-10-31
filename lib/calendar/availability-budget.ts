import "server-only";

import postgres from "postgres";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Claim one owner-wide Calendar read before either account credential is accessed. */
export async function claimCalendarAvailabilityRead(workspaceId: string): Promise<boolean> {
  const databaseUrl = process.env.WORKSPACE_CALENDAR_READER_DB_URL?.trim();
  if (!UUID_PATTERN.test(workspaceId) || !databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    return false;
  }

  try {
    const sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 2,
      idle_timeout: 1,
      connection: { statement_timeout: 2500, lock_timeout: 2000 }
    });
    try {
      const [identity] = await sql<{ role: string }[]>`select current_user as role`;
      if (identity?.role !== "workspace_calendar_reader") return false;
      const [claim] = await sql<{ allowed: boolean }[]>`
        select workspace.claim_calendar_availability_read(${workspaceId}::uuid) as allowed
      `;
      return claim?.allowed === true;
    } finally {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  } catch {
    return false;
  }
}
