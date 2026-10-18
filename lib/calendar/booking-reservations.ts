import "server-only";

import postgres from "postgres";

export type CalendarBookingMeetingType = "networking_30" | "networking_60";

export type CalendarBookingClaim = {
  reservationId: string;
  state: "held" | "writing" | "confirmed";
  holdExpiresAt: string;
  writeStarted: boolean;
};

export type CalendarBookingReceipt = Omit<CalendarBookingClaim, "state" | "writeStarted"> & {
  state: "held" | "writing" | "confirmed" | "released";
  meetingType: CalendarBookingMeetingType;
  startsAt: string;
  endsAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function assertBinding(workspaceId: string, requestDigest: string): void {
  if (!UUID_PATTERN.test(workspaceId) || !DIGEST_PATTERN.test(requestDigest)) {
    throw new Error("Invalid Calendar booking request.");
  }
}

function databaseUrl(): string {
  const url = process.env.WORKSPACE_CALENDAR_BOOKER_DB_URL?.trim();
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
    throw new Error("Calendar booking is unavailable.");
  }
  return url;
}

function bookingConnection() {
  try {
    return postgres(databaseUrl(), {
      max: 1,
      connect_timeout: 2,
      idle_timeout: 1,
      connection: { statement_timeout: 2500, lock_timeout: 2000 }
    });
  } catch {
    throw new Error("Calendar booking is unavailable.");
  }
}

function assertInterval(meetingType: CalendarBookingMeetingType, startsAt: string, endsAt: string): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!(["networking_30", "networking_60"] as string[]).includes(meetingType)
    || !UTC_PATTERN.test(startsAt) || !UTC_PATTERN.test(endsAt)
    || !Number.isFinite(start) || !Number.isFinite(end)
    || start <= Date.now()
    || end - start !== (meetingType === "networking_30" ? 30 : 60) * 60_000) {
    throw new Error("Invalid Calendar booking request.");
  }
}

/** Read an exact request receipt without reserving a new time. */
export async function findCalendarBooking(input: {
  workspaceId: string;
  requestDigest: string;
}): Promise<CalendarBookingReceipt | null> {
  assertBinding(input.workspaceId, input.requestDigest);
  const sql = bookingConnection();
  try {
    const [identity] = await sql<{ role: string }[]>`select current_user as role`;
    if (identity?.role !== "workspace_calendar_booker") throw new Error("Role mismatch.");
    const receipts = await sql<{
      reservation_id: string;
      reservation_state: string;
      meeting_type: string;
      starts_at: Date | string;
      ends_at: Date | string;
      hold_expires_at: Date | string;
    }[]>`
      select reservation_id, reservation_state, meeting_type, starts_at, ends_at, hold_expires_at
        from workspace.find_calendar_booking(${input.workspaceId}::uuid, ${input.requestDigest}::text)
    `;
    if (receipts.length === 0) return null;
    const receipt = receipts[0];
    const startsAt = receipt.starts_at instanceof Date ? receipt.starts_at.toISOString() : receipt.starts_at;
    const endsAt = receipt.ends_at instanceof Date ? receipt.ends_at.toISOString() : receipt.ends_at;
    const expiresAt = receipt.hold_expires_at instanceof Date ? receipt.hold_expires_at.toISOString() : receipt.hold_expires_at;
    if (receipts.length !== 1 || !UUID_PATTERN.test(receipt.reservation_id)
      || !["held", "writing", "confirmed", "released"].includes(receipt.reservation_state)
      || !["networking_30", "networking_60"].includes(receipt.meeting_type)
      || typeof startsAt !== "string" || !Number.isFinite(Date.parse(startsAt))
      || typeof endsAt !== "string" || !Number.isFinite(Date.parse(endsAt))
      || typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) {
      throw new Error("Invalid receipt result.");
    }
    return {
      reservationId: receipt.reservation_id,
      state: receipt.reservation_state as CalendarBookingReceipt["state"],
      meetingType: receipt.meeting_type as CalendarBookingMeetingType,
      startsAt,
      endsAt,
      holdExpiresAt: expiresAt
    };
  } catch {
    throw new Error("Calendar booking receipt is unavailable.");
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* Do not expose connection details. */ }
  }
}

export async function claimCalendarBooking(input: {
  workspaceId: string;
  requestDigest: string;
  meetingType: CalendarBookingMeetingType;
  startsAt: string;
  endsAt: string;
  beginWrite?: boolean;
}): Promise<CalendarBookingClaim> {
  assertBinding(input.workspaceId, input.requestDigest);
  assertInterval(input.meetingType, input.startsAt, input.endsAt);
  if (input.beginWrite !== undefined && typeof input.beginWrite !== "boolean") {
    throw new Error("Invalid Calendar booking request.");
  }

  const sql = bookingConnection();
  try {
    const [identity] = await sql<{ role: string }[]>`select current_user as role`;
    if (identity?.role !== "workspace_calendar_booker") throw new Error("Role mismatch.");
    const [claim] = await sql<{
      reservation_id: string;
      reservation_state: string;
      hold_expires_at: Date | string;
      write_started: boolean;
    }[]>`
      select reservation_id, reservation_state, hold_expires_at, write_started
        from workspace.claim_calendar_booking(
          ${input.workspaceId}::uuid, ${input.requestDigest}::text,
          ${input.meetingType}::text, ${input.startsAt}::timestamptz,
          ${input.endsAt}::timestamptz, ${input.beginWrite === true}::boolean
        )
    `;
    const expiresAt = claim?.hold_expires_at instanceof Date
      ? claim.hold_expires_at.toISOString() : claim?.hold_expires_at;
    if (!claim || !UUID_PATTERN.test(claim.reservation_id)
      || !["held", "writing", "confirmed"].includes(claim.reservation_state)
      || typeof claim.write_started !== "boolean"
      || (claim.write_started && (input.beginWrite !== true || claim.reservation_state !== "writing"))
      || (input.beginWrite === true && claim.reservation_state === "held")
      || typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) {
      throw new Error("Invalid claim result.");
    }
    return {
      reservationId: claim.reservation_id,
      state: claim.reservation_state as CalendarBookingClaim["state"],
      holdExpiresAt: expiresAt,
      writeStarted: claim.write_started
    };
  } catch {
    throw new Error("Calendar booking claim is unavailable.");
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* Do not expose connection details. */ }
  }
}

export async function finishCalendarBooking(input: {
  workspaceId: string;
  requestDigest: string;
  reservationId: string;
  expectedState: "held" | "writing";
  outcome: "confirmed" | "released";
  providerEventId?: string | null;
}): Promise<"confirmed" | "released"> {
  assertBinding(input.workspaceId, input.requestDigest);
  if (!UUID_PATTERN.test(input.reservationId)
    || !["held", "writing"].includes(input.expectedState)
    || !["confirmed", "released"].includes(input.outcome)
    || (input.outcome === "confirmed" && (typeof input.providerEventId !== "string"
      || input.providerEventId.length < 1 || input.providerEventId.length > 256))
    || (input.outcome === "released" && input.providerEventId != null)) {
    throw new Error("Invalid Calendar booking result.");
  }

  const sql = bookingConnection();
  try {
    const [identity] = await sql<{ role: string }[]>`select current_user as role`;
    if (identity?.role !== "workspace_calendar_booker") throw new Error("Role mismatch.");
    const [result] = await sql<{ state: string }[]>`
      select workspace.finish_calendar_booking(
        ${input.workspaceId}::uuid, ${input.requestDigest}::text,
        ${input.reservationId}::uuid, ${input.expectedState}::text, ${input.outcome}::text,
        ${input.providerEventId ?? null}::text
      ) as state
    `;
    if (result?.state !== input.outcome) throw new Error("Invalid finish result.");
    return input.outcome;
  } catch {
    throw new Error("Calendar booking result is unavailable.");
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* Do not expose connection details. */ }
  }
}
