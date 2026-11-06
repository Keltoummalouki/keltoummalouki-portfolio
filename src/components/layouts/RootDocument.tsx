import {
  Archivo,
  Inter,
  JetBrains_Mono,
  Manrope,
  Noto_Sans_Arabic,
  Outfit,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Sora,
  Space_Grotesk,
  Urbanist,
} from "next/font/google";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// The <html>/<body> shell shared by the two root layouts: `app/[locale]` (public
// site, lang/dir from the URL) and `app/admin`. There is no `app/layout.tsx`:
// a single root above `[locale]` could only learn the locale from the request
// headers, which made every page render per request instead of being cached.

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

// Archivo (headings) + Space Grotesk (body) are the published theme and are
// preloaded. The others only render when a visitor or admin picks another font
// preset, so they are fetched on demand instead of preloaded on every page.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-manrope",
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-outfit",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-plus-jakarta",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-sora",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-urbanist",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-playfair",
});

// Arabic UI font: self-hosted, not preloaded — only fetched when RTL text actually renders it.
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  preload: false,
  variable: "--font-noto-arabic",
});

const fontVariables = `${archivo.variable} ${spaceGrotesk.variable} ${inter.variable} ${manrope.variable} ${outfit.variable} ${plusJakarta.variable} ${sora.variable} ${urbanist.variable} ${jetbrainsMono.variable} ${playfair.variable} ${notoSansArabic.variable}`;

export default function RootDocument({
  lang,
  dir,
  children,
}: {
  lang: string;
  dir: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return (
    <html lang={lang} dir={dir} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
          >
            Skip to content
          </a>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
