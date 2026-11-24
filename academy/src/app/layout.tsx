import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Antigravity Academy — Enterprise AI Engineering & Harness Mastery",
  description:
    "Interactive glassmorphic learning platform and live reference showcase for mastering Google Antigravity, Enterprise Code Factory SDLC, Three.js harness visualizations, and copyable engineering prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen antialiased selection:bg-cyan-glow/30 selection:text-ink-primary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-void-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-primary focus:ring-2 focus:ring-cyan-glow"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
