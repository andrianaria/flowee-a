import { NextResponse } from "next/server"
import { applyRules } from "@/lib/ledger"
import { mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
export async function POST(request: Request) { try { const data = await readJson(request) as { dateFrom?: string; dateTo?: string }; const updated = mutateState(state => applyRules(state, data)); return NextResponse.json({ success: true, updated, count: updated, message: `${updated} transactions updated` }) } catch (error) { return apiError(error) } }
