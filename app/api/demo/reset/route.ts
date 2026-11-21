import { NextResponse } from "next/server"
import { resetState } from "@/lib/store"
import { apiError } from "@/lib/api-response"
export const runtime = "nodejs"
export async function POST() { try { resetState(); return NextResponse.json({ success: true }) } catch (error) { return apiError(error) } }
