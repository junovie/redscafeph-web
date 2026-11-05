import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu as MenuIcon, X } from "lucide-react";
import Logo from "@/components/Logo";
import { NAV } from "@/data/site";

const navClass = ({ isActive }) =>
  `text-sm tracking-wide transition-colors hover:text-red-brand ${isActive ? "text-red-brand" : "text-white"}`;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Logo className="scale-75 origin-left sm:scale-90" />
          <nav className="hidden items-center gap-10 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-5 border-t border-white/10 px-6 py-6 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-neutral-400">© {new Date().getFullYear()} RedscafePH</footer>
    </div>
  );
}
