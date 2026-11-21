"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, TrendingUp, DollarSign, BarChart3, FileText } from "lucide-react"

const ProfitLossReport = dynamic(() => import("./profit-loss-report").then((module) => module.ProfitLossReport))
const BalanceSheetReport = dynamic(() => import("./balance-sheet-report").then((module) => module.BalanceSheetReport))
const CashFlowReport = dynamic(() => import("./cash-flow-report").then((module) => module.CashFlowReport))
const EbitdaReport = dynamic(() => import("./ebitda-report").then((module) => module.EbitdaReport))

type ReportType = "profit-loss" | "balance-sheet" | "cash-flow" | "ebitda"

const reports = [
  { id: "profit-loss" as const, title: "Profit & Loss", description: "Revenue, cost of sales, operating costs and net income.", icon: TrendingUp, color: "bg-emerald-500" },
  { id: "ebitda" as const, title: "EBITDA", description: "Operating earnings, expense breakdown and profit margins.", icon: DollarSign, color: "bg-amber-500" },
  { id: "balance-sheet" as const, title: "Balance Sheet", description: "Cash, purchased assets, liabilities and equity at a selected date.", icon: DollarSign, color: "bg-blue-500" },
  { id: "cash-flow" as const, title: "Cash Flow", description: "Operating, investing and financing flows with opening and closing cash.", icon: BarChart3, color: "bg-purple-500" },
]

export function ReportDashboard() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [showDateRange, setShowDateRange] = useState(false)
  const [startDate, setStartDate] = useState("2026-11-01")
  const [endDate, setEndDate] = useState("2026-11-30")
  const validRange = Boolean(startDate && endDate && startDate <= endDate)
  const selectedStartDate = new Date(`${startDate}T00:00:00`)
  const selectedEndDate = new Date(`${endDate}T00:00:00`)

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSelectedReport(null)}>← Back to Reports</Button>
        {selectedReport === "profit-loss" && <ProfitLossReport initialStartDate={selectedStartDate} initialEndDate={selectedEndDate} />}
        {selectedReport === "ebitda" && <EbitdaReport initialStartDate={selectedStartDate} initialEndDate={selectedEndDate} />}
        {selectedReport === "balance-sheet" && <BalanceSheetReport initialAsOfDate={selectedEndDate} />}
        {selectedReport === "cash-flow" && <CashFlowReport initialStartDate={selectedStartDate} initialEndDate={selectedEndDate} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">Cash-book statements from categorized transactions.</p>
        </div>
        <Button variant="outline" onClick={() => setShowDateRange((current) => !current)} aria-expanded={showDateRange} aria-controls="report-date-range">
          <Calendar className="mr-2 h-4 w-4" aria-hidden="true" /> Set Date Range
        </Button>
      </div>

      {showDateRange && (
        <Card id="report-date-range">
          <CardHeader>
            <CardTitle className="text-lg">Report period</CardTitle>
            <CardDescription>Use November 2026 to view the sample transactions. Balance Sheet uses the end date.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label htmlFor="report-start-date" className="block text-sm font-medium">From</label>
                <input id="report-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="report-end-date" className="block text-sm font-medium">To</label>
                <input id="report-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm" />
              </div>
              <Button disabled={!validRange} onClick={() => setShowDateRange(false)}>Apply period</Button>
            </div>
            {!validRange && <p role="alert" className="mt-3 text-sm text-destructive">Choose both dates. The start date must be on or before the end date.</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-lg p-2 text-white ${report.color}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <Badge variant="secondary">On demand</Badge>
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" disabled={!validRange} onClick={() => setSelectedReport(report.id)}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Open {report.title}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">Reports include categorized and posted transactions only. Pending items are excluded. This cash-book uses cash receipts and payments; it does not post non-cash journals or accrual adjustments.</p>
    </div>
  )
}
