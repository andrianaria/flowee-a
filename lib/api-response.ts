import { NextResponse } from "next/server"
import { ValidationError } from "./ledger.ts"
export function apiError(error: unknown) {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ error: "Local data could not be read or saved. Check the terminal and local data file permissions." }, { status: 500 })
}
export async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length")
  if (length && Number(length) > 2_000_000) throw new ValidationError("Request is too large")
  const body = await request.text()
  if (body.length > 2_000_000) throw new ValidationError("Request is too large")
  let value: unknown
  try { value = JSON.parse(body) } catch { throw new ValidationError("Invalid JSON request") }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Expected a JSON object")
  return value
}
