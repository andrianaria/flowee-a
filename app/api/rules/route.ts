import { NextResponse } from "next/server"
import { saveRule, transactionMatches } from "@/lib/ledger"
import { getState, mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export function GET() { try { const state = getState(); return NextResponse.json({ rules: state.rules.map(rule => ({ ...rule, matches_count: state.transactions.filter(tx => transactionMatches(tx, rule)).length })).sort((a, b) => b.priority - a.priority) }) } catch (error) { return apiError(error) } }
export async function POST(request: Request) { try { const data = await readJson(request); return NextResponse.json({ rule: mutateState(state => saveRule(state, data)) }, { status: 201 }) } catch (error) { return apiError(error) } }
