import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Flowee", template: "%s · Flowee" },
  description: "Ruang kerja keuangan lokal untuk transaksi, kategori, dan laporan.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="id"><body className="min-h-screen antialiased">{children}<Toaster /></body></html>
}
