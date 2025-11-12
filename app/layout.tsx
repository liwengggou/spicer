import "./globals.css"
import { ReactQueryProvider } from "../components/ReactQueryProvider"
import type { ReactNode } from "react"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta-sans" })

export const metadata = {
  title: "Spicer",
  description: "Two-person spice challenge groups",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${plusJakarta.variable} font-display min-h-screen`}>
        <ReactQueryProvider>
          <div className="mx-auto max-w-3xl p-6">
            {children}
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
