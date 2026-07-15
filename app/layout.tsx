import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdaptaVídeo",
  description: "Adaptaciones educativas para vídeos de clase"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
