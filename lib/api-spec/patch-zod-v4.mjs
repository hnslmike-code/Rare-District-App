import { readFile, writeFile } from "node:fs/promises";

const generatedSchema = new URL("../api-zod/src/generated/api.ts", import.meta.url);
const source = await readFile(generatedSchema, "utf8");
const patched = source.replace("import * as zod from 'zod';", "import * as zod from 'zod/v4';");

if (source === patched) {
  throw new Error("Expected Zod import was not found in generated API schema.");
}

await writeFile(generatedSchema, patched);