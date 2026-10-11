import path from "node:path";

// All persistent state (SQLite DB + uploaded photos) lives under MELA_DATA_DIR.
// In production point it at a mounted volume (Railway volume / Render disk), e.g. /data.
export const DATA_DIR = process.env.MELA_DATA_DIR ?? path.join(process.cwd(), "data");
export const DB_PATH = process.env.MELA_DB_PATH ?? path.join(DATA_DIR, "mela.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
