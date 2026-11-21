import { NextResponse } from "next/server"
import { deleteTransaction, updateTransactions } from "@/lib/ledger"
import { mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
type Context = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, context: Context) { try { const { id } = await context.params; const data = await readJson(request); return NextResponse.json({ transaction: mutateState(state => updateTransactions(state, [id], data)[0]) }) } catch (error) { return apiError(error) } }
export const PUT = PATCH
export async function DELETE(_request: Request, context: Context) { try { const { id } = await context.params; mutateState(state => deleteTransaction(state, id)); return NextResponse.json({ success: true }) } catch (error) { return apiError(error) } }
