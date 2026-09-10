import { z } from "zod";

export const sourceIntakeFormats = ["plain_text", "markdown", "word_docx", "pdf"] as const;
export const sourceIntakeFormat = z.enum(sourceIntakeFormats);
export type SourceIntakeFormat = z.infer<typeof sourceIntakeFormat>;

export const sourceIntakeLimits = Object.freeze({
  maximumFileBytes: 4_000_000,
  maximumRequestBytes: 4_250_000,
  maximumExtractedCharacters: 100_000,
  maximumPdfPages: 100,
  maximumDocxEntries: 500,
  maximumDocxExpandedBytes: 15_000_000,
  maximumDocxEntryBytes: 10_000_000,
  maximumDocxCompressionRatio: 200,
  maximumFileNameCharacters: 255
});

export const sourceIntakeErrors = [
  "request_too_large", "missing_file", "unsupported_type", "file_too_large",
  "invalid_signature", "invalid_text_encoding", "unsafe_docx_archive",
  "password_protected", "pdf_page_limit", "needs_ocr",
  "extracted_text_too_large", "empty_document", "parse_failed"
] as const;
export const sourceIntakeErrorCode = z.enum(sourceIntakeErrors);

export const sourceIntakeWarnings = [
  "formatting_not_preserved", "images_not_imported",
  "pdf_reading_order_may_differ", "review_extracted_text"
] as const;
export const sourceIntakeWarning = z.enum(sourceIntakeWarnings);

const extensions: Record<string, SourceIntakeFormat> = {
  txt: "plain_text", md: "markdown", markdown: "markdown", docx: "word_docx", pdf: "pdf"
};
const allowedMediaTypes: Record<SourceIntakeFormat, ReadonlySet<string>> = {
  plain_text: new Set(["", "text/plain", "application/octet-stream"]),
  markdown: new Set(["", "text/markdown", "text/plain", "application/octet-stream"]),
  word_docx: new Set(["", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"]),
  pdf: new Set(["", "application/pdf", "application/octet-stream"])
};

export type SourceIntakeDescriptor = {
  fileName: string;
  mediaType: string;
  byteSize: number;
  format: SourceIntakeFormat;
};

export function inspectSourceIntakeDescriptor(input: { fileName: string; mediaType?: string; byteSize: number }): SourceIntakeDescriptor {
  if (/[\u0000-\u001f\u007f\\/]/.test(input.fileName)) throw new Error("unsupported_type");
  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > sourceIntakeLimits.maximumFileNameCharacters || fileName.startsWith(".") || fileName.includes(".."))
    throw new Error("unsupported_type");
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase() : "";
  const format = extensions[extension];
  const mediaType = (input.mediaType ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!format || !allowedMediaTypes[format].has(mediaType)) throw new Error("unsupported_type");
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1) throw new Error("empty_document");
  if (input.byteSize > sourceIntakeLimits.maximumFileBytes) throw new Error("file_too_large");
  return { fileName, mediaType, byteSize: input.byteSize, format };
}

export function sourceIntakeTitle(fileName: string): string {
  const base = fileName.replace(/\.(?:txt|md|markdown|docx|pdf)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Imported document").slice(0, 240);
}

export const sourceIntakeExtraction = z.object({
  schemaVersion: z.literal("1.0"),
  file: z.object({
    name: z.string().trim().min(1).max(sourceIntakeLimits.maximumFileNameCharacters),
    format: sourceIntakeFormat,
    mediaType: z.string().max(200),
    byteSize: z.number().int().min(1).max(sourceIntakeLimits.maximumFileBytes),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }).strict(),
  titleSuggestion: z.string().trim().min(1).max(240),
  text: z.string().min(1).max(sourceIntakeLimits.maximumExtractedCharacters),
  characterCount: z.number().int().min(1).max(sourceIntakeLimits.maximumExtractedCharacters),
  wordCount: z.number().int().min(1).max(sourceIntakeLimits.maximumExtractedCharacters),
  pageCount: z.number().int().min(1).max(sourceIntakeLimits.maximumPdfPages).nullable(),
  warnings: z.array(sourceIntakeWarning).min(1).max(sourceIntakeWarnings.length),
  originalRetained: z.literal(false)
}).strict().superRefine((value, context) => {
  if (value.characterCount !== value.text.length)
    context.addIssue({ code: "custom", path: ["characterCount"], message: "Character count must match extracted text." });
  if ((value.file.format === "pdf") !== (value.pageCount !== null))
    context.addIssue({ code: "custom", path: ["pageCount"], message: "Only PDF intake reports pages." });
  if (new Set(value.warnings).size !== value.warnings.length)
    context.addIssue({ code: "custom", path: ["warnings"], message: "Warnings must be unique." });
});
export type SourceIntakeExtraction = z.infer<typeof sourceIntakeExtraction>;
