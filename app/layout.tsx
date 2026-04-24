import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinMind Live Copilot",
  description: "AI-powered real-time meeting assistant with live transcription and contextual suggestions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
