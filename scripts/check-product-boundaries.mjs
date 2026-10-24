import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

const roots = ["app", "components", "lib", "supabase/functions"];
const forbidden = [/from\s+["'][^"']*(?:emergence-ministry|consulting-os|\/ministry\/|\/consulting\/)[^"']*["']/i, /SUPABASE_SERVICE_ROLE_KEY/, /getSupabaseAdminClient/];
const forbiddenEnvironmentKey = "SUPABASE_SERVICE_ROLE_KEY";

function constantEnvironmentReads(content, file) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX
    : file.endsWith(".ts") ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
  const constants = new Map();
  const aliases = new Map();

  function stringValue(node, seen = new Set()) {
    if (!node) return null;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return stringValue(node.expression, seen);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const part = stringValue(span.expression, seen);
        if (part === null) return null;
        value += part + span.literal.text;
      }
      return value;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = stringValue(node.left, seen);
      const right = stringValue(node.right, seen);
      return left === null || right === null ? null : left + right;
    }
    if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) {
      return stringValue(constants.get(node.text), new Set([...seen, node.text]));
    }
    return null;
  }

  function isEnvironment(node, seen = new Set()) {
    if (ts.isParenthesizedExpression(node)) return isEnvironment(node.expression, seen);
    if (ts.isIdentifier(node) && aliases.has(node.text) && !seen.has(node.text)) {
      return isEnvironment(aliases.get(node.text), new Set([...seen, node.text]));
    }
    const key = ts.isPropertyAccessExpression(node) ? node.name.text
      : ts.isElementAccessExpression(node) ? stringValue(node.argumentExpression) : null;
    return key === "env" && ts.isIdentifier(node.expression) && node.expression.text === "process";
  }

  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && node.parent.flags & ts.NodeFlags.Const) {
      constants.set(node.name.text, node.initializer);
      aliases.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  const lines = [];
  function inspect(node) {
    // The existing literal ban applies anywhere in runtime source. Preserve that
    // boundary when the same key is assembled before a named environment helper.
    if ((ts.isBinaryExpression(node) || ts.isTemplateExpression(node))
      && stringValue(node) === forbiddenEnvironmentKey) {
      lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    if (ts.isElementAccessExpression(node) && isEnvironment(node.expression)
      && stringValue(node.argumentExpression) === forbiddenEnvironmentKey) {
      lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  return lines;
}
const files = [];
async function collect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
}
for (const root of roots) await collect(root);
const violations = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const expression of forbidden) if (expression.test(content)) violations.push(`${file}: ${expression}`);
  for (const line of constantEnvironmentReads(content, file)) {
    violations.push(`${file}:${line}: computed service-role environment access`);
  }
}
if (violations.length) throw new Error(`Workspace product-boundary violations:\n${violations.join("\n")}`);
console.log(`Verified ${files.length} runtime files: no ministry/Consulting imports or service-role client.`);
