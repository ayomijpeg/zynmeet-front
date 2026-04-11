import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./globals.css"; // Ensure this file exists in /src/app/

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ZynMeet | Enterprise Virtual Venue",
  description: "Secure, Naira-billed high-capacity video conferencing for Nigeria.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-[#050505]`}>
        <GoogleOAuthProvider clientId={googleId}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
