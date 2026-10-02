"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/trackers", label: "Trackers" },
] as const;

export function MainNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#090a0b]/95 px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
    >
      <div className="mx-auto grid min-h-14 w-full max-w-xl grid-cols-4 items-center">
        {destinations.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${active ? "text-amber-100" : "text-stone-500 hover:text-stone-200"}`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/add"
          aria-label="Add something"
          className="col-start-4 row-start-1 flex min-h-11 items-center justify-center justify-self-end rounded-full border border-amber-100/30 px-4 text-sm font-medium text-stone-200 transition-colors hover:border-amber-100/60 hover:text-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 sm:px-5"
        >
          <span aria-hidden="true" className="mr-1.5 text-lg font-light text-amber-100 sm:mr-2">+</span>
          Add
        </Link>
      </div>
    </nav>
  );
}
