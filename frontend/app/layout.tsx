import type { Metadata } from "next";
import "./globals.css";

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
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
