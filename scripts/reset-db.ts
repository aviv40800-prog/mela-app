import fs from "node:fs";
import path from "node:path";

const file = process.env.MELA_DB_PATH ?? path.join(process.cwd(), "data", "mela.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
console.log(`Removed ${file}. It will be recreated and re-seeded on next start.`);
