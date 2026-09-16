import type { Metadata } from "next";
import './globals.css';
import Footer from '../components/footer/Footer';

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
      <body id="top">
        {children}
        <Footer />
      </body>
    </html>
  );
}