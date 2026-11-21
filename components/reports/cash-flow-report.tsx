"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { Download, RefreshCw } from "lucide-react"
import { useState, useRef } from "react"
import { slugifyReportName } from "@/lib/report-file-name"

interface CashFlowItem {
  name: string
  amount: number
  indent?: number
}

interface ActivitySection {
  title: string
  items: CashFlowItem[]
  total: number
}

export function CashFlowReport({
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
  const [company, setCompany] = useState<string>("")
  const reportRef = useRef<HTMLDivElement>(null)

  const fetchCashFlowData = async () => {
    try {
      setLoading(true)
      setError(null)
      const start = format(startDate, "yyyy-MM-dd")
      const end = format(endDate, "yyyy-MM-dd")

      const [response, settingsResponse] = await Promise.all([
        fetch(`/api/reports?type=cash-flow&startDate=${start}&endDate=${end}&organizationId=current`),
        fetch("/api/settings"),
      ])

      if (!response.ok) {
        const details = await response.json().catch(() => null)
        throw new Error(details?.error || "Failed to fetch cash flow data")
      }

      const data = await response.json()
      setReportData(data)

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json()
        setCompany(settings.organization?.name || "")
      }
    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load cash flow")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number): string => {
    if (amount === 0) return "0,00"
    const formatted = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount))
    return amount < 0 ? `(${formatted})` : formatted
  }

  const formatIDRCurrency = (amount: number): string => {
    return `Rp ${formatCurrency(amount)}`
  }

  const exportToPDF = async () => {
    if (!reportRef.current) return

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])
      const clone = reportRef.current.cloneNode(true) as HTMLElement
      const allElements = clone.querySelectorAll("*")

      allElements.forEach((el) => {
        const element = el as HTMLElement
        const computedStyle = window.getComputedStyle(el)

        element.style.backgroundColor = computedStyle.backgroundColor || "#ffffff"
        element.style.color = computedStyle.color || "#000000"
        element.style.borderColor = computedStyle.borderColor || "#e5e7eb"
      })

      document.body.appendChild(clone)

      const canvas = await html2canvas(clone, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      })

      document.body.removeChild(clone)

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.85)
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 10

      pdf.addImage(imgData, "JPEG", 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - 20

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "JPEG", 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight - 20
      }

      const companySlug = slugifyReportName(reportData.organization?.name || company)
      const filename = `arus-kas-${companySlug}-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.pdf`
      pdf.save(filename)
    } catch (error) {
      setError(`PDF export failed. ${error instanceof Error ? error.message : "Please try again."}`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div role="alert" className="text-center text-red-600">
            <p>Error loading cash flow: {error}</p>
            <Button className="mt-3" variant="outline" onClick={() => setError(null)}>Edit report filters</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const periodStr = `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`

  if (!reportData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Laporan Arus Kas</h2>
              <p className="text-sm text-gray-600">{periodStr}</p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="cf-start-date" className="text-sm">Dari</Label>
                <input
                  id="cf-start-date"
                  type="date"
                  value={format(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) { setStartDate(date); setReportData(null) }
                  }}
                  className="h-9 px-3 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="cf-end-date" className="text-sm">Sampai</Label>
                <input
                  id="cf-end-date"
                  type="date"
                  value={format(endDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) { setEndDate(date); setReportData(null) }
                  }}
                  className="h-9 px-3 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <Button onClick={fetchCashFlowData} className="gap-2" size="sm">
                <RefreshCw className="h-4 w-4" />
                Apply Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-10 text-center text-sm text-gray-600">
          Pilih periode lalu klik Apply Filter untuk memuat laporan.
        </CardContent>
      </Card>
    )
  }

  const netCashFlow = reportData.operating.total + reportData.investing.total + reportData.financing.total
  const beginningCash = reportData.beginningCash || 0
  const endingCash = beginningCash + netCashFlow

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Laporan Arus Kas</h2>
              <p className="text-sm text-gray-600">{periodStr}</p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="cf-start-date" className="text-sm">Dari</Label>
                <input
                  id="cf-start-date"
                  type="date"
                  value={format(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) {
                      setStartDate(date); setReportData(null)
                    }
                  }}
                  className="h-9 px-3 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="cf-end-date" className="text-sm">Sampai</Label>
                <input
                  id="cf-end-date"
                  type="date"
                  value={format(endDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(`${e.target.value}T00:00:00`)
                    if (!isNaN(date.getTime())) {
                      setEndDate(date); setReportData(null)
                    }
                  }}
                  className="h-9 px-3 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <Button onClick={fetchCashFlowData} className="gap-2" size="sm">
                <RefreshCw className="h-4 w-4" />
                Apply Filter
              </Button>
              <Button onClick={exportToPDF} className="gap-2" size="sm">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div ref={reportRef} className="bg-white p-8 space-y-6">
            {/* Report Header */}
            <div className="text-center space-y-1 mb-6">
              <h1 className="text-lg font-bold">{reportData.organization?.name || company || "Perusahaan"}</h1>
              <h2 className="text-base font-bold">ARUS KAS</h2>
              <p className="text-sm font-semibold">{periodStr}</p>
              <p className="text-xs text-gray-600">(dalam IDR)</p>
            </div>

            {/* Operating Activities */}
            <div>
              <div className="bg-blue-500 text-white py-2 px-4 flex justify-between items-center font-semibold mb-3">
                <span>Akun & Kategori</span>
                <span>{periodStr}</span>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-gray-800 text-sm">Arus kas dari Aktivitas Operasional</div>
                {reportData.operating.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="pl-4">{item.name}</span>
                    <span>{formatIDRCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 border-b-2 border-gray-400 font-bold text-sm">
                  <span>Kas bersih yang diperoleh dari Aktivitas Operasional</span>
                  <span>{formatIDRCurrency(reportData.operating.total)}</span>
                </div>
              </div>

              {/* Investing Activities */}
              <div className="space-y-2 mt-4">
                <div className="font-bold text-gray-800 text-sm mt-4">Arus kas dari Aktivitas Investasi</div>
                {reportData.investing.items.length > 0 ? (
                  <>
                    {reportData.investing.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="pl-4">{item.name}</span>
                        <span>{formatIDRCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="pl-4 text-gray-600">Tidak ada aktivitas investasi</span>
                    <span>{formatIDRCurrency(0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b-2 border-gray-400 font-bold text-sm">
                  <span>Kas bersih yang diperoleh dari Aktivitas Investasi</span>
                  <span>{formatIDRCurrency(reportData.investing.total)}</span>
                </div>
              </div>

              {/* Financing Activities */}
              <div className="space-y-2 mt-4">
                <div className="font-bold text-gray-800 text-sm mt-4">Arus kas dari Aktivitas Pendanaan</div>
                {reportData.financing.items.length > 0 ? (
                  <>
                    {reportData.financing.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="pl-4">{item.name}</span>
                        <span>{formatIDRCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="pl-4 text-gray-600">Tidak ada aktivitas pendanaan</span>
                    <span>{formatIDRCurrency(0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b-2 border-gray-400 font-bold text-sm">
                  <span>Kas bersih yang diperoleh dari Aktivitas Pendanaan</span>
                  <span>{formatIDRCurrency(reportData.financing.total)}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 mt-6 pt-4 border-t-2 border-gray-400">
                <div className="flex justify-between text-sm">
                  <span>Kenaikan (penurunan) kas</span>
                  <span className="font-semibold">{formatIDRCurrency(netCashFlow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total revaluasi bank</span>
                  <span>{formatIDRCurrency(0)}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b-2 border-gray-600">
                  <span>Saldo kas awal</span>
                  <span className="font-semibold">{formatIDRCurrency(beginningCash)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Saldo kas akhir</span>
                  <span>{formatIDRCurrency(endingCash)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
