"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";

const LINKS = [
  { href: "/kitchen", label: "Kitchen" },
  { href: "/cleaning", label: "Cleaning" },
];

/**
 * Small pill over the full-screen displays. It sits under Kitchen's own
 * fullscreen overlay (z 1000) so it never covers an open ticket.
 */
export function DisplaySwitcher({ canOpenConsole }: { canOpenConsole: boolean }) {
  const pathname = usePathname() || "";
  const link = "inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-inherit no-underline transition-colors hover:bg-white/10 hover:text-white";
  const onPage = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <nav aria-label="Displays"
      className="fixed bottom-3 right-3 z-[900] flex items-center gap-0.5 rounded-full bg-black/60 p-1 font-body text-sm text-white/80 backdrop-blur">
      {LINKS.filter((l) => !onPage(l.href)).map((l) => (
        <Link key={l.href} href={l.href} className={link}>{l.label}</Link>
      ))}
      <span aria-hidden="true" className="h-5 w-px bg-white/20" />
      {canOpenConsole ? (
        <Link href="/" className={link}>Console</Link>
      ) : (
        <SignOutButton redirectUrl="/">
          <button type="button" className={`${link} cursor-pointer border-0 bg-transparent font-body text-sm`}>Sign out</button>
        </SignOutButton>
      )}
    </nav>
  );
}
