import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import { WorkspaceCopilot } from "@/components/copilot/workspace-panel"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DClaw Doc",
  description: "DClaw vertical SaaS application",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <WorkspaceCopilot />
      </body>
    </html>
  )
}
