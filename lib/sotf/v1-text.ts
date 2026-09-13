import { z } from "zod";

// v1 preserves the deployed 500-unit projection and 100/240-unit field bounds.
// Unit: UTF-16 code units of decoded, well-formed text; never bytes, JSON escape
// characters, normalized text, or grapheme clusters. PostgreSQL has the same
// contract in sotf_v1_text_units / sotf_v1_text_prefix.
export const SOTF_V1_PROJECTION_TEXT_LIMIT = 500;

export function isSotfV1Text(value: string) {
  for (const character of value) {
    const point = character.codePointAt(0)!;
    // PostgreSQL UTF-8 text cannot represent NUL or an unpaired surrogate.
    if (point === 0 || (point >= 0xd800 && point <= 0xdfff)) return false;
  }
  return true;
}

export function sotfV1TextUnits(value: string) {
  if (!isSotfV1Text(value)) throw new Error("SOTF v1 requires well-formed text without NUL.");
  return value.length;
}

export function clipSotfV1Text(value: string, maximum: number) {
  if (!Number.isInteger(maximum) || maximum < 0) throw new Error("Invalid SOTF v1 text bound.");
  const measured = sotfV1TextUnits(value);
  if (measured <= maximum) return value;
  let units = 0;
  let prefix = "";
  for (const character of value) {
    const width = character.codePointAt(0)! > 0xffff ? 2 : 1;
    if (units + width > maximum) break;
    prefix += character;
    units += width;
  }
  return prefix;
}

export function sotfV1TextSchema(maximum: number, minimum = 0) {
  // Zod's min/max already use UTF-16 units. Keep those declarative bounds for
  // MCP JSON Schema export, adding the common decoded-text representability rule.
  return z.string().min(minimum).max(maximum).refine(isSotfV1Text, "Use well-formed text without NUL.");
}
