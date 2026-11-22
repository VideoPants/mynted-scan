import { randomBytes } from "node:crypto";

export function unguessableSlug(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}