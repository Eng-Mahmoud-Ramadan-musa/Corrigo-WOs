import type { Metadata } from "next";
import './globals.css';

export const metadata: Metadata = {
  title: "Corrigo WOs",
  description: "My application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}