import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { GlobalThemeToggle } from "@/components/global-theme-toggle"
import { TRPCReactProvider } from "@/lib/trpc/Provider"

export const metadata: Metadata = {
  title: "Alfred — Your AI Delivery Butler",
  description: "From idea to shipped — without the chaos.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TRPCReactProvider>
            <GlobalThemeToggle />
            {children}
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}