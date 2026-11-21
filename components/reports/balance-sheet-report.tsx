"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useState, useRef } from "react"
import { slugifyReportName } from "@/lib/report-file-name"

export function BalanceSheetReport({ initialAsOfDate }: { initialAsOfDate?: Date } = {}) {
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [asOfDate, setAsOfDate] = useState<Date>(initialAsOfDate || new Date("2026-11-30T00:00:00"))
  const printRef = useRef<HTMLDivElement>(null)

  const fetchBalanceSheetData = async () => {
    try {
      setLoading(true)
      setError(null)
      const endDate = format(asOfDate, "yyyy-MM-dd")
      const response = await fetch(`/api/reports?type=balance-sheet&endDate=${endDate}&organizationId=current`)

      if (!response.ok) {
        const details = await response.json().catch(() => null)
        throw new Error(details?.error || "Failed to fetch balance sheet data")
      }

      const data = await response.json()
      setReportData(data)
    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load balance sheet")
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = async () => {
    if (!reportData || exporting) return

    try {
      setExporting(true)
      const { jsPDF } = await import("jspdf")

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 14
      const amountX = pageWidth - margin
      let y = 16

      const currentTotalAssets =
        reportData.totals?.assets ??
        reportData.assets.current.total +
          reportData.assets.fixed.total +
          (reportData.assets.intangible?.total || 0) +
          (reportData.assets.other?.total || 0)
      const currentTotalLiabilities = reportData.liabilities.current.total + reportData.liabilities.longTerm.total
      const currentTotalEquity = reportData.equity.total
      const currentDifference =
        reportData.totals?.difference ?? currentTotalAssets - currentTotalLiabilities - currentTotalEquity

      const ensureSpace = (height = 8) => {
        if (y + height <= pageHeight - margin) return
        pdf.addPage()
        y = margin
      }

      const writeText = (text: string, x: number, options: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
        pdf.setFontSize(options.size || 10)
        pdf.setFont("helvetica", options.bold ? "bold" : "normal")
        pdf.setTextColor(...(options.color || [17, 24, 39]))
        pdf.text(String(text || "-"), x, y)
      }

      const writeAmount = (amount: number, options: { bold?: boolean; color?: [number, number, number] } = {}) => {
        pdf.setFontSize(10)
        pdf.setFont("helvetica", options.bold ? "bold" : "normal")
        pdf.setTextColor(...(options.color || [17, 24, 39]))
        pdf.text(formatCurrency(amount), amountX, y, { align: "right" })
      }

      const addLine = () => {
        pdf.setDrawColor(229, 231, 235)
        pdf.line(margin, y, pageWidth - margin, y)
      }

      const addSection = (title: string, amount: number, color: [number, number, number]) => {
        ensureSpace(11)
        y += 3
        writeText(title, margin, { size: 12, bold: true, color })
        writeAmount(amount, { bold: true, color })
        y += 4
        addLine()
        y += 5
      }

      const addRow = (label: string, amount: number, indent = 0, bold = false, negative = false) => {
        ensureSpace(7)
        const displayAmount = negative ? -Math.abs(amount) : amount
        const amountText = displayAmount < 0 ? `(${formatCurrency(Math.abs(displayAmount))})` : formatCurrency(displayAmount)
        pdf.setFontSize(9)
        pdf.setFont("helvetica", bold ? "bold" : "normal")
        pdf.setTextColor(55, 65, 81)
        const wrapped = pdf.splitTextToSize(label, amountX - margin - indent - 42)
        pdf.text(wrapped[0], margin + indent, y)
        pdf.text(amountText, amountX, y, { align: "right" })
        y += Math.max(6, wrapped.length * 4)
      }

      const addItems = (items: any[] = [], indent = 6) => {
        items.forEach((item) => addRow(accountLabel(item), item.amount, indent))
      }

      const companyName = reportData.organization?.name || "Perusahaan"

      pdf.setTextColor(17, 24, 39)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(14)
      pdf.text(companyName, pageWidth / 2, y, { align: "center" })
      y += 6
      pdf.setFontSize(16)
      pdf.text("NERACA / BALANCE SHEET", pageWidth / 2, y, { align: "center" })
      y += 7
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.text(`Per tanggal: ${format(asOfDate, "dd MMMM yyyy")}`, pageWidth / 2, y, { align: "center" })
      y += 9

      addSection("ASET / ASSETS", currentTotalAssets, [4, 120, 87])
      addRow("Aset Lancar / Current Assets", reportData.assets.current.total, 0, true)
      addItems(reportData.assets.current.items)

      addRow("Aset Tetap / Fixed Assets", reportData.assets.fixed.total, 0, true)
      addRow("Gross Fixed Assets", reportData.assets.fixed.grossTotal ?? reportData.assets.fixed.total, 6, true)
      addItems(reportData.assets.fixed.items, 10)
      ;(reportData.assets.fixed.contraItems || []).forEach((item: any) =>
        addRow(`Dikurangi ${accountLabel(item)}`, item.amount, 6, false, true),
      )
      addRow("Net Fixed Assets", reportData.assets.fixed.total, 6, true)

      if (reportData.assets.intangible?.items?.length || reportData.assets.intangible?.contraItems?.length) {
        addRow("Aset Tidak Berwujud / Intangible Assets", reportData.assets.intangible.total, 0, true)
        addRow("Gross Intangible Assets", reportData.assets.intangible.grossTotal, 6, true)
        addItems(reportData.assets.intangible.items, 10)
        ;(reportData.assets.intangible.contraItems || []).forEach((item: any) =>
          addRow(`Dikurangi ${accountLabel(item)}`, item.amount, 6, false, true),
        )
        addRow("Net Intangible Assets", reportData.assets.intangible.total, 6, true)
      }

      if (reportData.assets.other?.items?.length) {
        addRow("Aset Lainnya / Other Assets", reportData.assets.other.total, 0, true)
        addItems(reportData.assets.other.items)
      }

      addSection("LIABILITAS / LIABILITIES", currentTotalLiabilities, [185, 28, 28])
      addRow("Liabilitas Lancar / Current Liabilities", reportData.liabilities.current.total, 0, true)
      addItems(reportData.liabilities.current.items)
      addRow("Liabilitas Jangka Panjang / Long-term Liabilities", reportData.liabilities.longTerm.total, 0, true)
      addItems(reportData.liabilities.longTerm.items)

      addSection("EKUITAS / OWNER'S EQUITY", currentTotalEquity, [29, 78, 216])
      addItems(reportData.equity.items)

      y += 3
      addLine()
      y += 6
      addRow("TOTAL LIABILITAS + EKUITAS", currentTotalLiabilities + currentTotalEquity, 0, true)
      addRow("SELISIH", currentDifference, 0, true)

      const pageCount = pdf.getNumberOfPages()
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        pdf.setPage(pageNumber)
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(107, 114, 128)
        pdf.text(`${companyName} • Halaman ${pageNumber} dari ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" })
      }

      const companySlug = slugifyReportName(reportData.organization?.name)
      pdf.save(`neraca-${companySlug}-${format(asOfDate, "yyyy-MM-dd")}.pdf`)
    } catch (error) {

      alert(`Gagal membuat PDF. ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setExporting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div role="alert" className="text-center text-red-600">
              <p>Error loading balance sheet: {error}</p>
              <Button className="mt-3" variant="outline" onClick={() => setError(null)}>Edit report filters</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Neraca / Balance Sheet</CardTitle>
                <p className="text-muted-foreground">Per tanggal {format(asOfDate, "dd MMM yyyy")}</p>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="as-of-date">Per tanggal</Label>
                  <input
                    id="as-of-date"
                    type="date"
                    value={format(asOfDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const date = new Date(`${e.target.value}T00:00:00`)
                      if (!isNaN(date.getTime())) { setAsOfDate(date); setReportData(null) }
                    }}
                    className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button onClick={fetchBalanceSheetData} variant="default" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Apply Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pilih tanggal lalu klik Apply Filter untuk memuat laporan.
          </CardContent>
        </Card>
      </div>
    )
  }

  const reportCompanyName = reportData.organization?.name || "Perusahaan"
  const totalAssets =
    reportData.totals?.assets ??
    reportData.assets.current.total +
      reportData.assets.fixed.total +
      (reportData.assets.intangible?.total || 0) +
      (reportData.assets.other?.total || 0)
  const totalLiabilities = reportData.liabilities.current.total + reportData.liabilities.longTerm.total
  const totalEquity = reportData.equity.total
  const balanceDifference = reportData.totals?.difference ?? totalAssets - totalLiabilities - totalEquity
  const isBalanced = Math.abs(balanceDifference) < 0.01

  const accountLabel = (item: any) => (item.code ? `${item.code} - ${item.name}` : item.name)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Neraca / Balance Sheet</CardTitle>
              <p className="text-muted-foreground">Per tanggal {format(asOfDate, "dd MMM yyyy")}</p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="as-of-date">Per tanggal</Label>
                <input
                  id="as-of-date"
                  type="date"
                  value={format(asOfDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) {
                      setAsOfDate(date); setReportData(null)
                    }
                  }}
                  className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button onClick={fetchBalanceSheetData} variant="default" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Apply Filter
              </Button>
              <Button onClick={exportPDF} variant="outline" size="sm" disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Membuat PDF..." : "Export PDF"}
              </Button>
              <Badge variant="outline" className="text-sm">
                Total Aset: {formatCurrency(totalAssets)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent ref={printRef} id="balance-sheet-print-area" className="space-y-8">
          <div className="print:block hidden mb-6 text-center">
            <h1 className="text-xl font-bold mb-1">{reportCompanyName}</h1>
            <h2 className="text-2xl font-bold mb-2">NERACA / BALANCE SHEET</h2>
            <p className="text-lg">Per tanggal: {format(asOfDate, "dd MMMM yyyy")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Terakhir diperbarui: {format(new Date(), "dd MMM yyyy 'pukul' HH:mm:ss '(GMT+7)'")}
            </p>
          </div>

          <div className={`rounded-lg border px-4 py-3 ${isBalanced ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold ${isBalanced ? "text-emerald-700" : "text-red-700"}`}>
                {isBalanced ? "Neraca balance" : "Neraca belum balance"}
              </span>
              <span className={`font-semibold ${isBalanced ? "text-emerald-700" : "text-red-700"}`}>
                Selisih: {formatCurrency(balanceDifference)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-emerald-200">
              <h3 className="font-bold text-xl text-emerald-700">ASET / ASSETS</h3>
              <span className="font-bold text-xl text-emerald-700">{formatCurrency(totalAssets)}</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <h4 className="font-semibold text-lg">Aset Lancar / Current Assets</h4>
                <span className="font-semibold text-lg">{formatCurrency(reportData.assets.current.total)}</span>
              </div>
              {reportData.assets.current.items.map((item: any) => (
                <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                  <span className="text-muted-foreground">{accountLabel(item)}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <h4 className="font-semibold text-lg">Aset Tetap / Fixed Assets</h4>
                <span className="font-semibold text-lg">{formatCurrency(reportData.assets.fixed.total)}</span>
              </div>
              <div className="flex items-center justify-between py-2 pl-4 font-medium">
                <span>Gross Fixed Assets</span>
                <span>{formatCurrency(reportData.assets.fixed.grossTotal ?? reportData.assets.fixed.total)}</span>
              </div>
              {reportData.assets.fixed.items.map((item: any) => (
                <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-8">
                  <span className="text-muted-foreground">{accountLabel(item)}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {(reportData.assets.fixed.contraItems || []).map((item: any) => (
                <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                  <span className="text-muted-foreground">Dikurangi {accountLabel(item)}</span>
                  <span className="font-medium text-red-600">({formatCurrency(Math.abs(item.amount))})</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 pl-4 border-t border-gray-100 font-semibold">
                <span>Net Fixed Assets</span>
                <span>{formatCurrency(reportData.assets.fixed.total)}</span>
              </div>
            </div>

            {(reportData.assets.intangible?.items?.length > 0 ||
              reportData.assets.intangible?.contraItems?.length > 0) && (
              <div className="mt-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <h4 className="font-semibold text-lg">Aset Tidak Berwujud / Intangible Assets</h4>
                  <span className="font-semibold text-lg">{formatCurrency(reportData.assets.intangible.total)}</span>
                </div>
                <div className="flex items-center justify-between py-2 pl-4 font-medium">
                  <span>Gross Intangible Assets</span>
                  <span>{formatCurrency(reportData.assets.intangible.grossTotal)}</span>
                </div>
                {reportData.assets.intangible.items.map((item: any) => (
                  <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-8">
                    <span className="text-muted-foreground">{accountLabel(item)}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {(reportData.assets.intangible.contraItems || []).map((item: any) => (
                  <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                    <span className="text-muted-foreground">Dikurangi {accountLabel(item)}</span>
                    <span className="font-medium text-red-600">({formatCurrency(Math.abs(item.amount))})</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 pl-4 border-t border-gray-100 font-semibold">
                  <span>Net Intangible Assets</span>
                  <span>{formatCurrency(reportData.assets.intangible.total)}</span>
                </div>
              </div>
            )}

            {reportData.assets.other?.items?.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <h4 className="font-semibold text-lg">Aset Lainnya / Other Assets</h4>
                  <span className="font-semibold text-lg">{formatCurrency(reportData.assets.other.total)}</span>
                </div>
                {reportData.assets.other.items.map((item: any) => (
                  <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                    <span className="text-muted-foreground">{accountLabel(item)}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-red-200">
              <h3 className="font-bold text-xl text-red-700">LIABILITAS / LIABILITIES</h3>
              <span className="font-bold text-xl text-red-700">{formatCurrency(totalLiabilities)}</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <h4 className="font-semibold text-lg">Liabilitas Lancar / Current Liabilities</h4>
                <span className="font-semibold text-lg">{formatCurrency(reportData.liabilities.current.total)}</span>
              </div>
              {reportData.liabilities.current.items.map((item: any) => (
                <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                  <span className="text-muted-foreground">{accountLabel(item)}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <h4 className="font-semibold text-lg">Liabilitas Jangka Panjang / Long-term Liabilities</h4>
                <span className="font-semibold text-lg">{formatCurrency(reportData.liabilities.longTerm.total)}</span>
              </div>
              {reportData.liabilities.longTerm.items.map((item: any) => (
                <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                  <span className="text-muted-foreground">{accountLabel(item)}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between py-3 border-b-2 border-blue-200">
              <h3 className="font-bold text-xl text-blue-700">EKUITAS / OWNER'S EQUITY</h3>
              <span className="font-bold text-xl text-blue-700">{formatCurrency(totalEquity)}</span>
            </div>
            {reportData.equity.items.map((item: any) => (
              <div key={`${item.code || ""}-${item.name}`} className="flex items-center justify-between py-2 pl-4">
                <span className="text-muted-foreground">{accountLabel(item)}</span>
                <span className="font-medium">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between py-4 border-2 border-emerald-200 bg-emerald-50 px-4 rounded-lg">
            <h3 className="font-bold text-xl">TOTAL LIABILITAS + EKUITAS</h3>
            <span className="font-bold text-xl text-emerald-600">{formatCurrency(totalLiabilities + totalEquity)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
