import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(packageRoot, ".synthetic-build/browser/dist/auth/callback/index.html"), "utf8");
const keyFixture = JSON.parse(await readFile(resolve(packageRoot, "tests/fixtures/browser-signing-key.json"), "utf8"));
if (html.includes(keyFixture.privateJwk.d)) throw new Error("synthetic private signing material entered the browser artifact");
process.stdout.write("Synthetic browser artifact prepared; private signing material is absent from dist.\n");
