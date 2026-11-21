import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ organization: { name: "Example Demo Company" } })
}
