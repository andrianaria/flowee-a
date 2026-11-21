import { NextResponse } from "next/server"
import { saveRule, ValidationError } from "@/lib/ledger"
import { mutateState } from "@/lib/store"
import { apiError, readJson } from "@/lib/api-response"
export const runtime = "nodejs"
type Context = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, context: Context) { try { const { id } = await context.params; const data = await readJson(request); return NextResponse.json({ rule: mutateState(state => saveRule(state, data, id)) }) } catch (error) { return apiError(error) } }
export const PUT = PATCH
export async function DELETE(_request: Request, context: Context) { try { const { id } = await context.params; mutateState(state => { if (!state.rules.some(rule => rule.id === id)) throw new ValidationError("Rule not found"); state.rules = state.rules.filter(rule => rule.id !== id) }); return NextResponse.json({ success: true }) } catch (error) { return apiError(error) } }
