"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/grafik", label: "Grafik" },
  { href: "/dostepnosc", label: "Dostępność" },
  { href: "/godziny", label: "Godziny" },
  { href: "/miesiac", label: "Miesiąc" },
  { href: "/osoby", label: "Osoby" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link className="brand" href="/grafik">
        Grafik <span>Teatro</span>
      </Link>
      <nav className="nav" aria-label="Główna nawigacja">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "nav-link active" : "nav-link"}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
