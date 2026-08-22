import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/utils/theme";

export const metadata: Metadata = {
  title: "Reroute",
  description: "Charge AI agents per call, on Stellar.",
};

const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('reroute-theme');
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {}
`;

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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
