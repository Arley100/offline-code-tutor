import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvalForge / TutorBench Local",
  description:
    "Evaluation studio for offline AI coding tutors. Foundation only — artifact import and scoring not yet implemented.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              EvalForge
            </Link>
            <div className="flex gap-4 text-neutral-600 dark:text-neutral-300">
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/projects" className="hover:underline">
                Projects
              </Link>
              <Link href="/sign-in" className="hover:underline">
                Sign in
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-neutral-500">
          Independent portfolio/research project inspired by the ADTC 2026 Laptop
          LLM Challenge. Not an official ADTC submission.
        </footer>
      </body>
    </html>
  );
}
