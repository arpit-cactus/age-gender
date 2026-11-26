import type { Metadata } from "next";
import "./globals.css";
import { NavProvider } from "@/components/NavContext";

export const metadata: Metadata = {
  title: "VisionCount – Camsense AI People Analytics",
  description: "Real-time people counting, age estimation, and gender analytics dashboard powered by Camsense AI",
  icons: {
    icon: "/camsense-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/camsense-favicon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased">
        <NavProvider>{children}</NavProvider>
      </body>
    </html>
  );
}
