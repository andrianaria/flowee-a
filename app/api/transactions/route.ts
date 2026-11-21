import { NextResponse } from "next/server"
import { createTransaction, deleteTransaction, listTransactions, updateTransactions, ValidationError } from "@/lib/ledger"
import { getState, mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    return NextResponse.json(listTransactions(getState(), { startDate: params.get("startDate") || params.get("dateFrom") || undefined, endDate: params.get("endDate") || params.get("dateTo") || undefined, bankAccountId: params.get("bankAccountId") || undefined, status: params.get("status") || undefined }))
  } catch (error) { return apiError(error) }
}
export async function POST(request: Request) { try { const data = await readJson(request); return NextResponse.json({ transaction: mutateState(state => createTransaction(state, data)) }, { status: 201 }) } catch (error) { return apiError(error) } }
export async function PATCH(request: Request) { try { const data = await readJson(request) as { ids?: unknown; updates?: unknown }; return NextResponse.json({ transactions: mutateState(state => updateTransactions(state, data.ids, data.updates)) }) } catch (error) { return apiError(error) } }
export function DELETE(request: Request) { try { const id = new URL(request.url).searchParams.get("id"); if (!id) throw new ValidationError("Transaction id is required"); mutateState(state => deleteTransaction(state, id)); return NextResponse.json({ success: true }) } catch (error) { return apiError(error) } }
