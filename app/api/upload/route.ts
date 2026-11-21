import { NextResponse } from "next/server"
import { importTransactions } from "@/lib/ledger"
import { mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
export function GET() { return NextResponse.json({ templates: [] }) }
export async function POST(request: Request) { try { const data = await readJson(request); const summary = mutateState(state => importTransactions(state, data)); return NextResponse.json({ mode: "transactions", summary }) } catch (error) { return apiError(error) } }
