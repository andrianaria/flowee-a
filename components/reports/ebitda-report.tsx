"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Download, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { slugifyReportName } from "@/lib/report-file-name"

export function EbitdaReport({
  initialStartDate,
  initialEndDate,
}: {
  initialStartDate?: Date
  initialEndDate?: Date
} = {}) {
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(initialStartDate || new Date("2026-11-01T00:00:00"))
  const [endDate, setEndDate] = useState<Date>(initialEndDate || new Date("2026-11-30T00:00:00"))
  const printRef = useRef<HTMLDivElement>(null)

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        type: "ebitda",
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        organizationId: "current",
      })

      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) {
        const details = await response.json().catch(() => null)
        throw new Error(details?.error || "Failed to fetch report")
      }

      const data = await response.json()

      setReportData(data)
    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = async () => {
    try {
      if (!printRef.current) {

        alert("Gagal membuat PDF. Elemen laporan tidak ditemukan.")
        return
      }

      const printHeader = printRef.current.querySelector(".print\\:block")
      if (printHeader) {
        printHeader.classList.remove("hidden")
        printHeader.classList.add("block")
      }

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])
      const canvas = await html2canvas(printRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const clone = clonedDoc.body
          const allElements = clone.querySelectorAll("*")

          const sanitizeColor = (value: string | null, fallback: string) => {
            if (!value || value === "transparent") return fallback

            const v = value.trim().toLowerCase()

            const isSafe = v.startsWith("rgb(") || v.startsWith("rgba(") || v.startsWith("#")

            if (!isSafe || v.includes("oklch") || v.includes("color-mix")) {
              return fallback
            }

            return value
          }

          allElements.forEach((el) => {
            const element = el as HTMLElement
            const computedStyle = window.getComputedStyle(el)

            element.style.backgroundColor = sanitizeColor(computedStyle.backgroundColor, "#ffffff")
            element.style.color = sanitizeColor(computedStyle.color, "#000000")

            element.style.borderColor = sanitizeColor(computedStyle.borderColor, "#e5e7eb")
            element.style.borderTopColor = sanitizeColor(computedStyle.borderTopColor, "#e5e7eb")
            element.style.borderRightColor = sanitizeColor(computedStyle.borderRightColor, "#e5e7eb")
            element.style.borderBottomColor = sanitizeColor(computedStyle.borderBottomColor, "#e5e7eb")
            element.style.borderLeftColor = sanitizeColor(computedStyle.borderLeftColor, "#e5e7eb")

            if (element.style.backgroundColor.includes("var(")) element.style.backgroundColor = "#ffffff"
            if (element.style.color.includes("var(")) element.style.color = "#000000"
            if (element.style.borderColor.includes("var(")) element.style.borderColor = "#e5e7eb"
          })
        },
      })

      if (printHeader) {
        printHeader.classList.remove("block")
        printHeader.classList.add("hidden")
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.85)
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const imgWidth = pdfWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pageContentHeight = pdfHeight - margin * 2


      let heightLeft = imgHeight
      let position = margin
      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight)
      heightLeft -= pageContentHeight

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft)
        pdf.addPage()
        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight)
        heightLeft -= pageContentHeight
      }

      const pageCount = pdf.getNumberOfPages()
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        pdf.setPage(pageNumber)
        pdf.setFontSize(8)
        pdf.setTextColor(107, 114, 128)
        pdf.text(`Halaman ${pageNumber} dari ${pageCount}`, pdfWidth / 2, pdfHeight - 4, { align: "center" })
      }

      const companySlug = slugifyReportName(reportData.organization?.name)
      const filename = `laporan-ebitda-${companySlug}-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.pdf`

      pdf.save(filename)

    } catch (error) {

      alert(`Gagal membuat PDF. ${error instanceof Error ? error.message : "Silakan coba lagi."}`)
    }
  }


  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating EBITDA Report...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading report: {error}</p>
            <Button onClick={fetchReportData}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!reportData) {
    return (
      <Card className="no-print">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Laporan EBITDA</CardTitle>
              <p className="text-muted-foreground">
                {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date">From</Label>
                <input
                  id="start-date"
                  type="date"
                  value={format(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) { setStartDate(date); setReportData(null) }
                  }}
                  className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-date">To</Label>
                <input
                  id="end-date"
                  type="date"
                  value={format(endDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) { setEndDate(date); setReportData(null) }
                  }}
                  className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button onClick={fetchReportData} variant="default" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Apply Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Pilih periode lalu klik Apply Filter untuk memuat laporan.
        </CardContent>
      </Card>
    )
  }

  const toNumber = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value === "string") {
      const trimmed = value.trim()
      const isNegative = trimmed.startsWith("(") && trimmed.endsWith(")")
      let normalized = trimmed.replace(/[^\d,.-]/g, "")

      if (normalized.includes(",")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".")
      } else {
        const parts = normalized.split(".")
        if (parts.length > 2) normalized = parts.join("")
      }

      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? (isNegative ? -Math.abs(parsed) : parsed) : 0
    }
    return 0
  }

  const formatCurrency = (amount: unknown) => {
    const value = toNumber(amount)
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value))
  }

  const formatSignedCurrency = (amount: unknown) => {
    const value = toNumber(amount)
    return value < 0 ? `(${formatCurrency(value)})` : formatCurrency(value)
  }

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.0%"
    }
    return `${value.toFixed(1)}%`
  }

  const renderAccountItems = (items: any[], showNegative = false) => {
    return items.filter((item: any) => Math.abs(toNumber(item.amount)) >= 0.01).map((item: any) => (
      <div key={item.code || item.name} className="flex justify-between py-1 text-sm">
        <div className="flex gap-4">
          <span className="text-blue-600 font-mono text-xs w-16">{item.code}</span>
          <span>{item.name}</span>
        </div>
        <span className="font-mono">{showNegative ? formatSignedCurrency(-toNumber(item.amount)) : formatCurrency(item.amount)}</span>
      </div>
    ))
  }

  const reportCompanyName = reportData.organization?.name || "Perusahaan"
  const revenueTotal = toNumber(reportData.revenue?.total)
  const cogsTotal = toNumber(reportData.cogs?.total)
  const operatingExpenseItems = reportData.operatingExpenses?.items || []
  const operatingExpenseGroups = reportData.operatingExpenseGroups
  const calculatedOperatingExpenses = operatingExpenseItems.reduce((sum: number, item: any) => sum + toNumber(item.amount), 0)
  const hasValidAmount = (value: unknown) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
  const operatingExpensesTotal =
    reportData.operatingExpenses?.total === null ||
    reportData.operatingExpenses?.total === undefined ||
    Number.isNaN(Number(reportData.operatingExpenses?.total))
      ? calculatedOperatingExpenses
      : toNumber(reportData.operatingExpenses.total)
  const grossProfit = hasValidAmount(reportData.grossProfit)
    ? toNumber(reportData.grossProfit)
    : revenueTotal - cogsTotal
  const depreciation = toNumber(reportData.depreciation)
  const amortization = toNumber(reportData.amortization)
  const depreciationAmortization = toNumber(reportData.depreciationAmortization)
  const ebitda = hasValidAmount(reportData.ebitda)
    ? toNumber(reportData.ebitda)
    : grossProfit - operatingExpensesTotal
  const ebit = hasValidAmount(reportData.ebit)
    ? toNumber(reportData.ebit)
    : ebitda - depreciationAmortization
  const nonOperatingExpenseItems = reportData.nonOperatingExpenses?.items || []
  const nonOperatingExpenses = hasValidAmount(reportData.nonOperatingExpenses?.total)
    ? toNumber(reportData.nonOperatingExpenses.total)
    : toNumber(reportData.interest)
  const ebt = hasValidAmount(reportData.ebt) ? toNumber(reportData.ebt) : ebit - nonOperatingExpenses
  const taxes = toNumber(reportData.taxes)
  const netIncome = hasValidAmount(reportData.netIncome) ? toNumber(reportData.netIncome) : ebt - taxes
  const totalExpenses =
    hasValidAmount(reportData.totalExpenses)
      ? toNumber(reportData.totalExpenses)
      : cogsTotal + operatingExpensesTotal + depreciationAmortization + nonOperatingExpenses + taxes
  const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0
  const ebitdaMargin = revenueTotal > 0 ? (ebitda / revenueTotal) * 100 : 0
  const ebitMargin = revenueTotal > 0 ? (ebit / revenueTotal) * 100 : 0
  const netMargin = revenueTotal > 0 ? (netIncome / revenueTotal) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="no-print">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Laporan EBITDA</CardTitle>
              <p className="text-muted-foreground">
                {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date">From</Label>
                <input
                  id="start-date"
                  type="date"
                  value={format(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) {
                      setStartDate(date); setReportData(null)
                    }
                  }}
                  className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-date">To</Label>
                <input
                  id="end-date"
                  type="date"
                  value={format(endDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) {
                      setEndDate(date); setReportData(null)
                    }
                  }}
                  className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button onClick={fetchReportData} variant="default" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Apply Filter
              </Button>
              <Button onClick={exportPDF} variant="outline" className="flex items-center gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div ref={printRef} className="bg-white">
        <div className="p-8 space-y-6">
          {/* Header for print */}
          <div className="text-center border-b pb-4 print:block hidden">
            <h1 className="text-xl font-bold">{reportCompanyName}</h1>
            <h2 className="text-2xl font-bold mt-1">LAPORAN EBITDA</h2>
            <p className="text-lg">
              Periode: {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Terakhir diperbarui: {format(new Date(), "dd MMM yyyy 'pada' HH:mm:ss '(GMT+7)'")}
            </p>
          </div>

          <div className="space-y-6">
            {/* Revenue Section */}
            <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Pendapatan</span>
                <span className="font-mono">{formatCurrency(revenueTotal)}</span>
              </div>
              <div className="pl-4 space-y-1 mt-2">{renderAccountItems(reportData.revenue.items)}</div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total Pendapatan</span>
                <span className="font-mono">{formatCurrency(revenueTotal)}</span>
              </div>
            </div>

            {/* COGS Section */}
            {cogsTotal > 0 && (
              <div>
                <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                  <span>Beban Pokok Pendapatan</span>
                  <span className="font-mono">({formatCurrency(cogsTotal)})</span>
                </div>
                <div className="pl-4 space-y-1 mt-2">{renderAccountItems(reportData.cogs.items, true)}</div>
                <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                  <span>Total Beban Pokok Pendapatan</span>
                  <span className="font-mono">({formatCurrency(cogsTotal)})</span>
                </div>
              </div>
            )}

            {/* Gross Profit */}
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>Laba Kotor</span>
                <span className="font-mono">{formatCurrency(grossProfit)}</span>
              </div>
              <div className="text-sm text-gray-600">Margin: {formatPercentage(grossMargin)}</div>
            </div>

            {/* Operating Expenses */}
            {operatingExpenseGroups ? (
              <div className="space-y-6">
                {Math.abs(toNumber(operatingExpenseGroups.rent.total)) >= 0.01 && <div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                    <span>Beban Sewa</span>
                    <span className="font-mono">{formatSignedCurrency(-toNumber(operatingExpenseGroups.rent.total))}</span>
                  </div>
                  <div className="pl-4 space-y-1 mt-2">{renderAccountItems(operatingExpenseGroups.rent.items, true)}</div>
                </div>}
                {Math.abs(toNumber(operatingExpenseGroups.marketingAndPlatform.total)) >= 0.01 && <div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                    <span>Beban Pemasaran & Komisi Platform</span>
                    <span className="font-mono">
                      {formatSignedCurrency(-toNumber(operatingExpenseGroups.marketingAndPlatform.total))}
                    </span>
                  </div>
                  <div className="pl-4 space-y-1 mt-2">
                    {renderAccountItems(operatingExpenseGroups.marketingAndPlatform.items, true)}
                  </div>
                </div>}
                {Math.abs(toNumber(operatingExpenseGroups.managementFee.total)) >= 0.01 && <div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                    <span>Beban Management Fee</span>
                    <span className="font-mono">
                      {formatSignedCurrency(-toNumber(operatingExpenseGroups.managementFee.total))}
                    </span>
                  </div>
                  <div className="pl-4 space-y-1 mt-2">
                    {renderAccountItems(operatingExpenseGroups.managementFee.items, true)}
                  </div>
                </div>}
                {Math.abs(toNumber(operatingExpenseGroups.otherOperating.total)) >= 0.01 && <div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                    <span>Beban Operasional</span>
                    <span className="font-mono">
                      {formatSignedCurrency(-toNumber(operatingExpenseGroups.otherOperating.total))}
                    </span>
                  </div>
                  <div className="pl-4 space-y-1 mt-2">
                    {renderAccountItems(operatingExpenseGroups.otherOperating.items, true)}
                  </div>
                </div>}
                <div className="flex justify-between py-2 border-b border-gray-200 font-semibold">
                  <span>Total Seluruh Beban Operasional</span>
                  <span className="font-mono">{formatSignedCurrency(-operatingExpensesTotal)}</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                  <span>Beban Operasional</span>
                  <span className="font-mono">({formatCurrency(operatingExpensesTotal)})</span>
                </div>
                <div className="pl-4 space-y-1 mt-2">{renderAccountItems(operatingExpenseItems, true)}</div>
                <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                  <span>Total Beban Operasional</span>
                  <span className="font-mono">({formatCurrency(operatingExpensesTotal)})</span>
                </div>
              </div>
            )}

            {/* EBITDA - Main highlight */}
            <div className="bg-amber-50 p-4 rounded border-2 border-amber-300">
              <div className="flex justify-between py-2 font-bold text-2xl">
                <span>EBITDA</span>
                <span className={`font-mono ${ebitda >= 0 ? "text-amber-700" : "text-red-600"}`}>
                  {formatSignedCurrency(ebitda)}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>EBITDA Margin: {formatPercentage(ebitdaMargin)}</div>
                <div className="text-xs mt-1 text-gray-500">
                  Earnings Before Interest, Taxes, Depreciation & Amortization
                </div>
              </div>
            </div>

            {/* D&A Section */}
            <div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold">
                <span>Penyusutan</span>
                <span className="font-mono">({formatCurrency(depreciation)})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold">
                <span>Amortisasi</span>
                <span className="font-mono">({formatCurrency(amortization)})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-bold">
                <span>Total Penyusutan & Amortisasi</span>
                <span className="font-mono">({formatCurrency(depreciationAmortization)})</span>
              </div>
            </div>

            {/* EBIT */}
            <div className="bg-blue-50 p-4 rounded border-2 border-blue-200">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>EBIT (Laba Operasional)</span>
                <span className={`font-mono ${ebit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatSignedCurrency(ebit)}
                </span>
              </div>
              <div className="text-sm text-gray-600">EBIT Margin: {formatPercentage(ebitMargin)}</div>
            </div>

            {/* Non-operating expenses */}
            {nonOperatingExpenses !== 0 && (
              <div>
                <div className="flex justify-between py-2 border-b-2 border-gray-300 font-semibold">
                  <span>Beban Non-operasional</span>
                  <span className="font-mono">{formatSignedCurrency(-nonOperatingExpenses)}</span>
                </div>
                <div className="pl-4 space-y-1 mt-2">{renderAccountItems(nonOperatingExpenseItems, true)}</div>
              </div>
            )}

            {/* EBT */}
            <div className="bg-indigo-50 p-4 rounded border border-indigo-200">
              <div className="flex justify-between py-2 font-bold text-lg">
                <span>EBT (Laba Sebelum Pajak)</span>
                <span className={`font-mono ${ebt >= 0 ? "text-indigo-600" : "text-red-600"}`}>
                  {formatSignedCurrency(ebt)}
                </span>
              </div>
            </div>

            {/* Taxes */}
            {taxes > 0 && (
              <div>
                <div className="flex justify-between py-2 border-b border-gray-200 font-semibold">
                  <span>Beban Pajak</span>
                  <span className="font-mono">({formatCurrency(taxes)})</span>
                </div>
              </div>
            )}

            {/* Net Income */}
            <div
              className={`p-4 rounded border-2 ${netIncome >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div className="flex justify-between py-2 font-bold text-2xl">
                <span>Laba Bersih</span>
                <span className={`font-mono ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {netIncome >= 0
                    ? formatCurrency(netIncome)
                    : `(${formatCurrency(netIncome)})`}
                </span>
              </div>
              <div className="text-sm text-gray-600">Net Margin: {formatPercentage(netMargin)}</div>
            </div>

            {/* Summary Stats */}
            <div className="mt-8 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="font-semibold text-gray-700">Profitabilitas</div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Margin:</span>
                    <span className="font-mono">{formatPercentage(grossMargin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">EBITDA Margin:</span>
                    <span className="font-mono">{formatPercentage(ebitdaMargin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">EBIT Margin:</span>
                    <span className="font-mono">{formatPercentage(ebitMargin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Margin:</span>
                    <span className="font-mono">{formatPercentage(netMargin)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-gray-700">Ringkasan</div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pendapatan:</span>
                    <span className="font-mono">{formatCurrency(revenueTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Beban:</span>
                    <span className="font-mono">{formatCurrency(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaksi:</span>
                    <span className="font-mono">{reportData.transactionCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
