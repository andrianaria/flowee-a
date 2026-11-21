import { NextResponse } from "next/server"
import { createAccount } from "@/lib/ledger"
import { getState, mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export function GET() { try { return NextResponse.json({ accounts: getState().accounts }) } catch (error) { return apiError(error) } }
export async function POST(request: Request) { try { const data = await readJson(request); return NextResponse.json({ account: mutateState(state => createAccount(state, data)) }, { status: 201 }) } catch (error) { return apiError(error) } }
