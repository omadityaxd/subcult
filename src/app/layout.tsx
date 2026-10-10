import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque } from "next/font/google"
import { MotionProvider } from "@/components/providers/motion-provider"
import { AppFrame } from "@/components/shell/app-frame"
import { siteUrl } from "@/lib/env"
import { THEME_BOOT_SCRIPT } from "@/lib/theme"
import "./globals.css"

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
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
    icon: [{ url: "/icons/192", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-180", sizes: "180x180" }],
  },
  openGraph: { siteName: "subcult", title: "subcult", description: DESCRIPTION, type: "website" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a10",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>
          <AppFrame>{children}</AppFrame>
        </MotionProvider>
      </body>
    </html>
  )
}
