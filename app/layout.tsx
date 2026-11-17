import type { Metadata } from "next";
import { Literata, Silkscreen, Work_Sans } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

// Literata for reading, Work Sans for the interface, Silkscreen for the game layer (XP, levels, tests).
const read = Literata({ variable: "--font-read", subsets: ["latin"] });
const ui = Work_Sans({ variable: "--font-ui", subsets: ["latin"] });
const game = Silkscreen({ variable: "--font-game-px", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Ingrain — read once, know it for good",
  description:
    "Turn a book chapter or slide deck into a concept map, short visual lessons, and quick checks that prove you understood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${read.variable} ${ui.variable} ${game.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
