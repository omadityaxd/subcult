import type { Metadata, Viewport } from "next"
import { Geist, Instrument_Serif } from "next/font/google"
import { MotionProvider } from "@/components/providers/motion-provider"
import { siteUrl } from "@/lib/env"
import { THEME_BOOT_SCRIPT } from "@/lib/theme"
import "./globals.css"
import { AnalyticsProvider } from "@/components/providers/analytics-provider"
import { TruncationTitles } from "@/components/a11y/truncation-titles"

const sans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
})

const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
})

const DESCRIPTION =
  "find your niche. sounds, tea, fits and community for your exact vibe, in one feed."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "subcult · find your niche", template: "%s · subcult" },
  description: DESCRIPTION,
  applicationName: "subcult",
  appleWebApp: { capable: true, title: "subcult", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/32", type: "image/png", sizes: "32x32" },
      { url: "/icons/192", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-180", sizes: "180x180" }],
  },
  openGraph: { siteName: "subcult", title: "subcult", description: DESCRIPTION, type: "website" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
        <AnalyticsProvider />
        <TruncationTitles />
      </body>
    </html>
  )
}
