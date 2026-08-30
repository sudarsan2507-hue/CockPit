import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebMCP Forge",
  description:
    "Generate WebMCP tools from a web app, then prove which ones are safe for an agent to use.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
