import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MediathekArr",
  description: "Mediathek indexer for Sonarr/Radarr",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
