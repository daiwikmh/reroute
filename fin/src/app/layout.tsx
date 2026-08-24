import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reroute",
  description: "Charge AI agents per call, on Stellar.",
  icons: {
    icon: "/mark.png",
    shortcut: "/mark.png",
    apple: "/mark.png",
  },
  openGraph: {
    title: "Reroute",
    description: "Charge AI agents per call, on Stellar.",
    images: ["/mark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://db.onlinewebfonts.com/c/58ee300970307a1cc399e6bebd7617ce?family=Bamboly+Demo"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600&family=Poppins:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
