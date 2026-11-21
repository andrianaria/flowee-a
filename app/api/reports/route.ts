import { NextRequest, NextResponse } from "next/server"
import { buildReport, ReportInputError, type ReportType } from "@/lib/reporting"
import { getState } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const type = params.get("type") as ReportType | null
    if (!type) return NextResponse.json({ error: "Report type is required" }, { status: 400 })
    const report = buildReport(await getState(), {
      type,
      startDate: params.get("startDate") ?? undefined,
      endDate: params.get("endDate") ?? undefined,
    })
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof ReportInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: "Unable to generate report" }, { status: 500 })
  }
}
