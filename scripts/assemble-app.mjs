import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/routes/_restore");
const out = join(root, "src/routes/app.tsx");

if (!existsSync(dir)) {
  console.log("assemble-app: no _restore dir");
  process.exit(0);
}

const parts = readdirSync(dir)
  .filter((f) => /^p\d+\.txt$/.test(f))
  .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));

if (parts.length >= 16) {
  const full = parts
    .map((f) => Buffer.from(readFileSync(join(dir, f), "utf8").replace(/\s+/g, ""), "base64").toString("utf8"))
    .join("");
  writeFileSync(out, full);
  console.log("assemble-app: restored app.tsx", full.length, "from", parts.length, "parts");
} else {
  console.log("assemble-app: incomplete (", parts.length, "/ 16), keeping existing app.tsx");
}
