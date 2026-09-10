import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
vi.mock("server-only", () => ({}));
import { extractSourceBytes, inspectDocxArchive, SourceIntakeFailure } from "@/lib/source-intake/extract";

async function docx(text: string, extras = 0) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  for (let index = 0; index < extras; index++) zip.file(`word/extra-${index}.xml`, `<x>${index}</x>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function pdf(text: string) {
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(output, "latin1"));
}

describe("rich source extraction", () => {
  it("extracts UTF-8 text and returns only a bounded non-retention receipt", async () => {
    const result = await extractSourceBytes({ fileName: "Fictional_notes.txt", mediaType: "text/plain", bytes: new TextEncoder().encode("A useful source\r\nwith context.") });
    expect(result).toMatchObject({ titleSuggestion: "Fictional notes", text: "A useful source\nwith context.", characterCount: 29,
      wordCount: 5, pageCount: null, originalRetained: false, warnings: ["review_extracted_text"] });
    expect(result.file.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("extracts raw Word text after inspecting archive expansion", async () => {
    const bytes = await docx("A fictional sermon about practiced welcome.");
    expect(inspectDocxArchive(bytes)).toMatchObject({ entryCount: 5 });
    const result = await extractSourceBytes({ fileName: "welcome-sermon.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes });
    expect(result.text).toContain("A fictional sermon about practiced welcome.");
    expect(result.warnings).toEqual(["formatting_not_preserved", "images_not_imported", "review_extracted_text"]);
  });

  it("extracts text and page count from a real PDF byte stream", async () => {
    const result = await extractSourceBytes({ fileName: "fictional-filing.pdf", mediaType: "application/pdf", bytes: pdf("Fictional filing evidence for review") });
    expect(result.text).toContain("Fictional filing evidence for review");
    expect(result.pageCount).toBe(1);
    expect(result.warnings).toContain("pdf_reading_order_may_differ");
  }, 15_000);

  it.each([
    ["wrong PDF signature", { fileName: "false.pdf", mediaType: "application/pdf", bytes: new TextEncoder().encode("not a PDF") }, "invalid_signature"],
    ["invalid UTF-8", { fileName: "bad.txt", mediaType: "text/plain", bytes: new Uint8Array([0xff, 0xfe, 0xfd]) }, "invalid_text_encoding"],
    ["binary text", { fileName: "binary.txt", mediaType: "text/plain", bytes: new Uint8Array([65, 0, 66]) }, "invalid_text_encoding"]
  ] as const)("rejects %s without parser details", async (_label, input, code) => {
    await expect(extractSourceBytes(input)).rejects.toMatchObject({ code });
  });

  it("rejects a DOCX entry-count bomb before extraction", async () => {
    const bytes = await docx("Safe visible text", 500);
    expect(() => inspectDocxArchive(bytes)).toThrowError(SourceIntakeFailure);
    await expect(extractSourceBytes({ fileName: "too-many.docx", mediaType: "application/octet-stream", bytes })).rejects.toMatchObject({ code: "unsafe_docx_archive" });
  });

  it("rejects a truncated DOCX without leaking a DataView parser error", async () => {
    await expect(extractSourceBytes({ fileName: "truncated.docx", mediaType: "application/zip", bytes: new Uint8Array([0x50, 0x4b]) }))
      .rejects.toMatchObject({ code: "unsafe_docx_archive" });
  });
});
