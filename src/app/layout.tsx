import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SettingsProvider } from "@/contexts/settings-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RundfunkArr",
  description: "Rundfunk indexer for Sonarr/Radarr",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (darkMode) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <SettingsProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop/Tablet Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Navigation */}
              <MobileNav />

              {/* Page Content */}
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
