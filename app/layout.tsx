import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import UpdateNotifier from "@/components/UpdateNotifier";
import { getPublicAppMeta } from "@/lib/appMeta";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Restok",
    template: "%s - Restok",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08111f" },
    { media: "(prefers-color-scheme: light)", color: "#f6fbff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appMeta = getPublicAppMeta();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved/preferred theme before first paint so there is no
            flash, and so it applies app-wide (including public pages). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme')||localStorage.getItem('restok-theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {children}
        <UpdateNotifier
          initialVersion={appMeta.version}
          initialSignature={appMeta.deploymentSignature}
        />
      </body>
    </html>
  );
}
