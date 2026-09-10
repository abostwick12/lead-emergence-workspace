import "server-only";
import { createHash } from "node:crypto";
import mammoth from "mammoth";
import {
  inspectSourceIntakeDescriptor, sourceIntakeExtraction, sourceIntakeLimits,
  sourceIntakeTitle, type SourceIntakeExtraction, type SourceIntakeFormat
} from "./contracts";

export class SourceIntakeFailure extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); }
}

const failureMessages: Record<string, [number, string]> = {
  request_too_large: [413, "Choose one supported document up to 4 MB."],
  missing_file: [400, "Choose a document to extract."],
  unsupported_type: [415, "Choose a .txt, .md, .docx, or .pdf document."],
  file_too_large: [413, "Choose a document up to 4 MB."],
  invalid_signature: [415, "The document contents do not match its file type."],
  invalid_text_encoding: [422, "This text file is not readable UTF-8 text."],
  unsafe_docx_archive: [422, "This Word document expands beyond the safe intake limits."],
  password_protected: [422, "Remove the PDF password before importing. Workspace never asks for or stores it."],
  pdf_page_limit: [413, "Choose a PDF with no more than 100 pages, or split it into smaller sources."],
  needs_ocr: [422, "No usable text was found. This may be a scanned PDF; OCR is not performed here."],
  extracted_text_too_large: [413, "The extracted text exceeds 100,000 characters. Split the document before importing."],
  empty_document: [422, "This document does not contain usable text."],
  parse_failed: [422, "Workspace could not safely extract this document. Try a text export instead."]
};
export function intakeFailure(code: string): SourceIntakeFailure {
  const [status, message] = failureMessages[code] ?? failureMessages.parse_failed;
  return new SourceIntakeFailure(code, status, message);
}

function u16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number) { return view.getUint32(offset, true); }
function safeZipName(name: string) {
  return name.length > 0 && !name.includes("\0") && !name.includes("\\") && !name.startsWith("/")
    && !/^[A-Za-z]:/.test(name) && !name.split("/").some(part => part === "..");
}

// DOCX is a ZIP container. Read only the central-directory metadata before
// Mammoth sees it; no entry is written to disk or accepted solely by extension.
export function inspectDocxArchive(bytes: Uint8Array) {
  if (bytes.byteLength < 22) throw intakeFailure("unsafe_docx_archive");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const first = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= first; offset--) {
    if (u32(view, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || u16(view, eocd + 4) !== 0 || u16(view, eocd + 6) !== 0) throw intakeFailure("unsafe_docx_archive");
  const entriesOnDisk = u16(view, eocd + 8), entryCount = u16(view, eocd + 10);
  const directoryBytes = u32(view, eocd + 12), directoryOffset = u32(view, eocd + 16);
  if (!entryCount || entryCount !== entriesOnDisk || entryCount === 0xffff || entryCount > sourceIntakeLimits.maximumDocxEntries
    || directoryBytes === 0xffffffff || directoryOffset === 0xffffffff || directoryOffset + directoryBytes > eocd)
    throw intakeFailure("unsafe_docx_archive");
  let offset = directoryOffset, expandedBytes = 0, compressedBytes = 0;
  const names = new Set<string>();
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > directoryOffset + directoryBytes || u32(view, offset) !== 0x02014b50) throw intakeFailure("unsafe_docx_archive");
    const compressed = u32(view, offset + 20), expanded = u32(view, offset + 24);
    const nameBytes = u16(view, offset + 28), extraBytes = u16(view, offset + 30), commentBytes = u16(view, offset + 32);
    const disk = u16(view, offset + 34), next = offset + 46 + nameBytes + extraBytes + commentBytes;
    if (compressed === 0xffffffff || expanded === 0xffffffff || disk !== 0 || next > directoryOffset + directoryBytes
      || expanded > sourceIntakeLimits.maximumDocxEntryBytes) throw intakeFailure("unsafe_docx_archive");
    const name = Buffer.from(bytes.buffer, bytes.byteOffset + offset + 46, nameBytes).toString("utf8");
    if (!safeZipName(name) || names.has(name)) throw intakeFailure("unsafe_docx_archive");
    names.add(name); expandedBytes += expanded; compressedBytes += compressed; offset = next;
    if (expandedBytes > sourceIntakeLimits.maximumDocxExpandedBytes) throw intakeFailure("unsafe_docx_archive");
  }
  if (offset !== directoryOffset + directoryBytes || !names.has("[Content_Types].xml") || !names.has("word/document.xml")
    || expandedBytes / Math.max(1, compressedBytes) > sourceIntakeLimits.maximumDocxCompressionRatio)
    throw intakeFailure("unsafe_docx_archive");
  return { entryCount, expandedBytes, compressedBytes };
}

function normalizeText(raw: string) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) throw intakeFailure("empty_document");
  if (text.includes("\0")) throw intakeFailure("invalid_text_encoding");
  if (text.length > sourceIntakeLimits.maximumExtractedCharacters) throw intakeFailure("extracted_text_too_large");
  return text;
}
function countWords(text: string) { return text.split(/\s+/u).filter(Boolean).length; }
function hasPdfHeader(bytes: Uint8Array) {
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true,
    useSystemFonts: false, useWorkerFetch: false, useWasm: false, verbosity: pdfjs.VerbosityLevel.ERRORS });
  let document: Awaited<typeof loading.promise> | null = null;
  try {
    document = await loading.promise;
    if (document.numPages > sourceIntakeLimits.maximumPdfPages) throw intakeFailure("pdf_page_limit");
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim());
      page.cleanup();
      if (pages.reduce((total, value) => total + value.length, 0) > sourceIntakeLimits.maximumExtractedCharacters)
        throw intakeFailure("extracted_text_too_large");
    }
    const text = pages.join("\n\n").trim();
    if ((text.match(/[\p{L}\p{N}]/gu) ?? []).length < 10) throw intakeFailure("needs_ocr");
    return { text, pageCount: document.numPages };
  } catch (error) {
    if (error instanceof SourceIntakeFailure) throw error;
    if (error && typeof error === "object" && "name" in error && error.name === "PasswordException") throw intakeFailure("password_protected");
    throw intakeFailure("parse_failed");
  } finally {
    await loading.destroy();
  }
}

function signature(format: SourceIntakeFormat, bytes: Uint8Array) {
  if (format === "word_docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw intakeFailure("invalid_signature");
  if (format === "pdf" && !hasPdfHeader(bytes)) throw intakeFailure("invalid_signature");
}

export async function extractSourceBytes(input: { fileName: string; mediaType?: string; bytes: Uint8Array }): Promise<SourceIntakeExtraction> {
  let descriptor;
  try { descriptor = inspectSourceIntakeDescriptor({ fileName: input.fileName, mediaType: input.mediaType, byteSize: input.bytes.byteLength }); }
  catch (error) { throw intakeFailure(error instanceof Error ? error.message : "unsupported_type"); }
  signature(descriptor.format, input.bytes);
  let raw: string, pageCount: number | null = null;
  const warnings = descriptor.format === "pdf"
    ? ["formatting_not_preserved", "images_not_imported", "pdf_reading_order_may_differ", "review_extracted_text"] as const
    : descriptor.format === "word_docx"
      ? ["formatting_not_preserved", "images_not_imported", "review_extracted_text"] as const
      : ["review_extracted_text"] as const;
  try {
    if (descriptor.format === "plain_text" || descriptor.format === "markdown") {
      try { raw = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes); }
      catch { throw intakeFailure("invalid_text_encoding"); }
    } else if (descriptor.format === "word_docx") {
      inspectDocxArchive(input.bytes);
      raw = (await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) })).value;
    } else {
      const pdf = await extractPdf(input.bytes); raw = pdf.text; pageCount = pdf.pageCount;
    }
  } catch (error) {
    if (error instanceof SourceIntakeFailure) throw error;
    throw intakeFailure("parse_failed");
  }
  const text = normalizeText(raw);
  return sourceIntakeExtraction.parse({ schemaVersion: "1.0", file: { name: descriptor.fileName,
    format: descriptor.format, mediaType: descriptor.mediaType, byteSize: descriptor.byteSize,
    sha256: createHash("sha256").update(input.bytes).digest("hex") }, titleSuggestion: sourceIntakeTitle(descriptor.fileName),
    text, characterCount: text.length, wordCount: countWords(text), pageCount, warnings: [...warnings], originalRetained: false });
}
