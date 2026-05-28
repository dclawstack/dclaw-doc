import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DClaw Doc — AI-native document workspace",
  description:
    "Verifiable AI with paragraph-level citations, real-time collaboration, and compliance-first workflows. Open source on GitHub.",
  metadataBase: new URL("https://dclawstack.io"),
  openGraph: {
    title: "DClaw Doc",
    description:
      "AI-native document workspace with verifiable citations, CRDT collaboration, and audit-grade compliance.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
