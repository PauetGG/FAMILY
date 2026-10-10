import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Family Love Food",
  description: "Dieta, compra i tiquets compartits de casa",
  applicationName: "Family Love Food",
  appleWebApp: {
    capable: true,
    title: "Family Love Food",
    statusBarStyle: "black",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
