import { NextResponse } from "next/server"
export function GET() { return NextResponse.json({ bankAccounts: [{ id: "demo-wallet", name: "Local wallet", bank_name: "Demo", currency: "IDR", upload_mode: "transactions" }] }) }
