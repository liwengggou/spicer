import "./globals.css"
import { ReactQueryProvider } from "../components/ReactQueryProvider"
import type { ReactNode } from "react"

export const metadata = {
  title: "Spicer",
  description: "Two-person spice challenge groups",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ReactQueryProvider>
          <div className="mx-auto max-w-3xl p-6">
            {children}
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
