"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Download, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { slugifyReportName } from "@/lib/report-file-name"

export function ProfitLossReport({
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

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Laba Rugi - ${format(startDate, "dd-MM-yyyy")} to ${format(endDate, "dd-MM-yyyy")}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.5;
              color: #000;
              -webkit-print-color-adjust: exact;
            }
            .no-print { display: none !important; }
            .hidden { display: block !important; }
            .print\\:block { display: block !important; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .p-8 { padding: 2rem; }
            .p-4 { padding: 1rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .pl-4 { padding-left: 1rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-8 { margin-top: 2rem; }
            .pt-4 { margin-top: 1rem; }
            .pb-4 { padding-bottom: 1rem; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-b-2 { border-bottom: 2px solid #d1d5db; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-2 { border: 2px solid; }
            .border-gray-200 { border-color: #e5e7eb; }
            .border-gray-300 { border-color: #d1d5db; }
            .border-blue-200 { border-color: #bfdbfe; }
            .border-green-200 { border-color: #bbf7d0; }
            .border-red-200 { border-color: #fecaca; }
            .bg-white { background-color: #fff; }
            .bg-gray-50 { background-color: #f9fafb; }
            .bg-blue-50 { background-color: #eff6ff; }
            .bg-green-50 { background-color: #f0fdf4; }
            .bg-red-50 { background-color: #fef2f2; }
            .rounded { border-radius: 0.375rem; }
            .text-center { text-align: center; }
            .text-sm { font-size: 0.875rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
            .text-blue-600 { color: #2563eb; }
            .text-green-600 { color: #16a34a; }
            .text-red-600 { color: #dc2626; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .justify-end { justify-content: flex-end; }
            .w-16 { width: 4rem; }
            .w-20 { width: 5rem; }
            .gap-4 { gap: 1rem; }
            .gap-6 { gap: 1.5rem; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()

    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const handleExportCSV = () => {
    if (!reportData) return

    const companyName = reportData.organization?.name || "Example Demo Company"
    const companySlug = slugifyReportName(companyName)
    const netRevenue = reportData.revenue.total || 0
    const rows: (string | number)[][] = [
      [companyName],
      ["Laporan Laba Rugi"],
      [`Periode: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`],
      [],
      ["Variabel", "Nominal", "% dari Net Revenue"],
    ]
    const addRow = (label: string, amount: number) => {
      rows.push([label, amount.toFixed(2), `${(netRevenue ? amount / netRevenue * 100 : 0).toFixed(1)}%`])
    }
    const addSection = (title: string, section: { total: number; items: { code: string; name: string; amount: number }[] }, sign = 1) => {
      addRow(title, section.total * sign)
      for (const item of section.items) addRow(`  ${item.code} - ${item.name}`, item.amount * sign)
      addRow(`Total ${title}`, section.total * sign)
      rows.push([])
    }

    addSection("Pendapatan", reportData.revenue)
    addSection("Beban Pokok Pendapatan", reportData.cogs, -1)
    addRow("Laba Kotor", reportData.summary.grossProfit)
    rows.push([])
    const groups = reportData.operatingExpenseGroups
    for (const [title, section] of [
      ["Beban Sewa", groups.rent],
      ["Beban Pemasaran & Komisi Platform", groups.marketingAndPlatform],
      ["Beban Management Fee", groups.managementFee],
      ["Beban Operasional", groups.otherOperating],
    ] as const) {
      if (Math.abs(section.total) >= 0.01) addSection(title, section, -1)
    }
    addRow("Total Seluruh Beban Operasional", -reportData.operatingExpenses.total)
    addRow("EBITDA", reportData.summary.ebitda)
    rows.push([])
    addSection("Beban Penyusutan", reportData.depreciation, -1)
    addSection("Beban Amortisasi", reportData.amortization, -1)
    addRow("EBIT", reportData.summary.ebit)
    rows.push([])
    addSection("Beban Non-operasional", reportData.nonOperatingExpenses, -1)
    addRow("Laba Sebelum Pajak (EBT)", reportData.summary.ebt)
    rows.push([])
    addSection("Beban Pajak", reportData.taxExpenses, -1)
    addRow("Laba Bersih", reportData.summary.netIncome)

    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `laporan-laba-rugi-${companySlug}-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: html2canvas } = await import("html2canvas")

      if (!printRef.current) {

        alert("Gagal membuat PDF. Elemen laporan tidak ditemukan.")
        return
      }

      // Make header visible for PDF
      const printHeader = printRef.current.querySelector(".print\\:block")
      if (printHeader) {
        printHeader.classList.remove("hidden")
        printHeader.classList.add("block")
      }

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

            // html2canvas happy dengan rgb/rgba/hex
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

            // jaga-jaga kalau masih ada var(...)
            if (element.style.backgroundColor.includes("var(")) element.style.backgroundColor = "#ffffff"
            if (element.style.color.includes("var(")) element.style.color = "#000000"
            if (element.style.borderColor.includes("var(")) element.style.borderColor = "#e5e7eb"
          })
        },
      })

      // Hide header again
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
      const footerHeight = 6
      const availableWidth = pdfWidth - margin * 2
      const availableHeight = pdfHeight - margin * 2 - footerHeight
      const scaleToFit = Math.min(availableWidth / canvas.width, availableHeight / canvas.height)
      const imgWidth = canvas.width * scaleToFit
      const imgHeight = canvas.height * scaleToFit
      const positionX = (pdfWidth - imgWidth) / 2
      const positionY = margin


      pdf.addImage(imgData, "JPEG", positionX, positionY, imgWidth, imgHeight)
      pdf.setFontSize(8)
      pdf.setTextColor(107, 114, 128)
      pdf.text("Halaman 1 dari 1", pdfWidth / 2, pdfHeight - 4, { align: "center" })

      const companySlug = slugifyReportName(reportData.organization?.name)
      const fileName = `laporan-laba-rugi-${companySlug}-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.pdf`
      pdf.save(fileName)

    } catch (error) {

      alert(`Gagal membuat PDF. ${error instanceof Error ? error.message : "Silakan coba lagi."}`)
    }
  }

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        type: "profit-loss",
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

  const applyDatePreset = (preset: "current-month" | "last-month" | "last-three-months" | "current-year") => {
    const today = new Date()
    let presetStart = new Date(today.getFullYear(), today.getMonth(), 1)
    let presetEnd = today

    if (preset === "last-month") {
      presetStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      presetEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    } else if (preset === "last-three-months") {
      presetStart = new Date(today.getFullYear(), today.getMonth() - 2, 1)
    } else if (preset === "current-year") {
      presetStart = new Date(today.getFullYear(), 0, 1)
    }

    setStartDate(presetStart)
    setEndDate(presetEnd)
    setReportData(null)
  }

  const datePresetButtons = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Preset:</span>
      <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset("current-month")}>
        Bulan Ini
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset("last-month")}>
        Bulan Lalu
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset("last-three-months")}>
        3 Bulan
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset("current-year")}>
        Tahun Ini
      </Button>
    </div>
  )


  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating Profit & Loss Report...</span>
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
              <CardTitle className="text-2xl">Laporan Laba Rugi</CardTitle>
              <p className="text-muted-foreground">
                {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {datePresetButtons}
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

  const reportCompanyName = reportData.organization?.name || "Perusahaan"
  const grossProfit = reportData.summary.grossProfit
  const ebitda = reportData.summary.ebitda
  const ebit = reportData.summary.ebit
  const ebt = reportData.summary.ebt
  const netIncome = reportData.summary.netIncome
  const netRevenue = reportData.revenue.total || 0
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount))
  }

  const formatSignedCurrency = (amount: number) =>
    amount < 0 ? `(${formatCurrency(amount)})` : formatCurrency(amount)
  const formatPercentage = (amount: number) => {
    if (netRevenue === 0) return "0,0%"

    const percentage = (amount / netRevenue) * 100
    const formatted = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(percentage))

    return percentage < 0 ? `(${formatted}%)` : `${formatted}%`
  }
  const renderAmountWithPercentage = (amount: number, className = "") => (
    <div className="flex items-center justify-end gap-6 font-mono">
      <span className={className}>{formatSignedCurrency(amount)}</span>
      <span className="w-20 text-right text-gray-500">{formatPercentage(amount)}</span>
    </div>
  )

  const renderAccountItems = (items: any[], showNegative = false) => {
    return items.filter((item: any) => Math.abs(Number(item.amount || 0)) >= 0.01).map((item: any) => {
      const signedAmount = showNegative ? -item.amount : item.amount

      return (
        <div key={item.code || item.name} className="flex justify-between py-1 text-sm">
          <div className="flex gap-4">
            <span className="text-blue-600 font-mono text-xs w-16">{item.code}</span>
            <span>{item.name}</span>
          </div>
          {renderAmountWithPercentage(signedAmount)}
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Controls - Hidden in print */}
      <Card className="no-print">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Laporan Laba Rugi</CardTitle>
              <p className="text-muted-foreground">
                {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {datePresetButtons}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={exportPDF} variant="outline" className="flex items-center gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div ref={printRef} className="bg-white">
        <div className="p-8 space-y-6">
          {/* Header for print */}
          <div className="text-center border-b pb-4 print:block hidden">
            <h1 className="text-xl font-bold">{reportCompanyName}</h1>
            <h2 className="text-2xl font-bold mt-1">LAPORAN LABA RUGI</h2>
            <p className="text-lg">
              Periode: {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Terakhir diperbarui: {format(new Date(), "dd MMM yyyy 'pada' HH:mm:ss '(GMT+7)'")}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between border-b border-gray-200 pb-2 text-xs font-semibold text-gray-500">
              <span>Variabel</span>
              <div className="flex justify-end gap-6 font-mono">
                <span>Nominal</span>
                <span className="w-20 text-right">% Net Revenue</span>
              </div>
            </div>

            {/* Pendapatan Section */}
            <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Pendapatan</span>
                {renderAmountWithPercentage(reportData.revenue.total)}
              </div>
              <div className="pl-4 space-y-1 mt-2">{renderAccountItems(reportData.revenue.items)}</div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total dari pendapatan</span>
                {renderAmountWithPercentage(reportData.revenue.total)}
              </div>
            </div>

            {/* Beban Pokok Pendapatan (COGS) */}
            {reportData.cogs.total > 0 && (
              <div>
                <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                  <span>Beban pokok pendapatan</span>
                  {renderAmountWithPercentage(-reportData.cogs.total)}
                </div>
                <div className="pl-4 space-y-1 mt-2">{renderAccountItems(reportData.cogs.items, true)}</div>
                <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                  <span>Total dari beban pokok pendapatan</span>
                  {renderAmountWithPercentage(-reportData.cogs.total)}
                </div>
              </div>
            )}

            {/* Laba Kotor */}
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>Laba kotor</span>
                {renderAmountWithPercentage(grossProfit)}
              </div>
            </div>

            {/* Beban Sewa */}
            {Math.abs(reportData.operatingExpenseGroups.rent.total) >= 0.01 && <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban sewa</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.rent.total)}
              </div>
              <div className="pl-4 space-y-1 mt-2">
                {renderAccountItems(reportData.operatingExpenseGroups.rent.items, true)}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total dari beban sewa</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.rent.total)}
              </div>
            </div>}

            {/* Beban Pemasaran dan Komisi Platform */}
            {Math.abs(reportData.operatingExpenseGroups.marketingAndPlatform.total) >= 0.01 && <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban pemasaran & komisi platform</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.marketingAndPlatform.total)}
              </div>
              <div className="pl-4 space-y-1 mt-2">
                {renderAccountItems(reportData.operatingExpenseGroups.marketingAndPlatform.items, true)}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total dari beban pemasaran & komisi platform</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.marketingAndPlatform.total)}
              </div>
            </div>}

            {/* Beban Management Fee */}
            {Math.abs(reportData.operatingExpenseGroups.managementFee.total) >= 0.01 && <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban management fee</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.managementFee.total)}
              </div>
              <div className="pl-4 space-y-1 mt-2">
                {renderAccountItems(reportData.operatingExpenseGroups.managementFee.items, true)}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total dari beban management fee</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.managementFee.total)}
              </div>
            </div>}

            {/* Beban Operasional Lainnya */}
            {Math.abs(reportData.operatingExpenseGroups.otherOperating.total) >= 0.01 && <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban operasional</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.otherOperating.total)}
              </div>
              <div className="pl-4 space-y-1 mt-2">
                {renderAccountItems(reportData.operatingExpenseGroups.otherOperating.items, true)}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total dari beban operasional</span>
                {renderAmountWithPercentage(-reportData.operatingExpenseGroups.otherOperating.total)}
              </div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold mt-2">
                <span>Total seluruh beban operasional</span>
                {renderAmountWithPercentage(-reportData.operatingExpenses.total)}
              </div>
            </div>}

            {/* EBITDA */}
            <div className="bg-blue-50 p-4 rounded border-2 border-blue-200">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>EBITDA</span>
                {renderAmountWithPercentage(ebitda, "text-blue-600")}
              </div>
            </div>

            {/* Depreciation and amortization */}
            <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Penyusutan dan amortisasi</span>
                {renderAmountWithPercentage(-(reportData.depreciation.total + reportData.amortization.total))}
              </div>
              <div className="pl-4 space-y-1 mt-2">
                {renderAccountItems(reportData.depreciation.items, true)}
                {renderAccountItems(reportData.amortization.items, true)}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 font-semibold mt-2">
                <span>Total penyusutan dan amortisasi</span>
                {renderAmountWithPercentage(-(reportData.depreciation.total + reportData.amortization.total))}
              </div>
            </div>

            {/* EBIT */}
            <div className="bg-gray-50 p-4 rounded border-2 border-gray-200">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>Laba operasional (EBIT)</span>
                {renderAmountWithPercentage(ebit)}
              </div>
            </div>

            {/* Non-operating expenses */}
            <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban non-operasional</span>
                {renderAmountWithPercentage(-reportData.nonOperatingExpenses.total)}
              </div>
              {reportData.nonOperatingExpenses.items.length > 0 ? (
                <div className="pl-4 space-y-1 mt-2">
                  {renderAccountItems(reportData.nonOperatingExpenses.items, true)}
                </div>
              ) : (
                <div className="pl-4 py-4 text-sm text-gray-500">Tidak ada beban non-operasional</div>
              )}
            </div>

            {/* EBT */}
            <div className="bg-gray-50 p-4 rounded border-2 border-gray-200">
              <div className="flex justify-between py-2 font-bold text-xl">
                <span>Laba sebelum pajak (EBT)</span>
                {renderAmountWithPercentage(ebt)}
              </div>
            </div>

            {/* Tax expense */}
            <div>
              <div className="flex justify-between py-2 border-b-2 border-gray-300 font-bold text-lg">
                <span>Beban pajak</span>
                {renderAmountWithPercentage(-reportData.taxExpenses.total)}
              </div>
              {reportData.taxExpenses.items.length > 0 ? (
                <div className="pl-4 space-y-1 mt-2">{renderAccountItems(reportData.taxExpenses.items, true)}</div>
              ) : (
                <div className="pl-4 py-4 text-sm text-gray-500">Tidak ada beban pajak</div>
              )}
            </div>

            {/* Final Net Income */}
            <div
              className={`p-4 rounded border-2 ${netIncome >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div className="flex justify-between py-2 font-bold text-2xl">
                <span>Laba bersih</span>
                {renderAmountWithPercentage(netIncome, netIncome >= 0 ? "text-green-600" : "text-red-600")}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Berdasarkan {reportData.transactionCount || 0} transaksi yang sudah dikategorikan</span>
                <span>Margin kotor: {grossMargin.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
