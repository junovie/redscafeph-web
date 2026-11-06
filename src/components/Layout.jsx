import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu as MenuIcon, X } from "lucide-react";
import Logo from "@/components/Logo";
import SocialIcons from "@/components/SocialIcons";
import { HOURS, LOCATIONS, NAV, PERKS_URL } from "@/data/site";

const navClass = ({ isActive }) =>
  `font-display text-sm uppercase tracking-[0.2em] transition-colors hover:text-red-brand ${isActive ? "text-red-brand" : "text-paper"}`;

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-coal">
      <div className="container-page grid gap-12 py-16 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 font-script text-2xl text-cream">It's home.</p>
          <SocialIcons className="mt-6" />
        </div>
        <div>
          <p className="label">Visit us</p>
          <ul className="space-y-3 text-sm">
            {LOCATIONS.map((l) => (
              <li key={l.name}>
                <a href={l.map} target="_blank" rel="noreferrer" className="hover:text-red-brand">
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-paper/60">{l.where}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Hours</p>
          <p className="text-sm text-paper/75">{HOURS}</p>
          <p className="mt-1 text-sm text-paper/75">Look for us in Grab too!</p>
          <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="font-display text-xs uppercase tracking-[0.2em] hover:text-red-brand">
                {n.label}
              </Link>
            ))}
            <a href={PERKS_URL} target="_blank" rel="noreferrer" className="font-display text-xs uppercase tracking-[0.2em] hover:text-red-brand">
              My Points
            </a>
          </nav>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-paper/50">© {new Date().getFullYear()} RedscafePH</p>
    </footer>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 backdrop-blur">
        <div className="container-page flex items-center justify-between py-3">
          <Logo />
          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end className={navClass}>
                {n.label}
              </NavLink>
            ))}
            <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-solid px-5 py-2 text-xs">
              My Points
            </a>
          </nav>
          <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
          </button>
        </div>
        {open && (
          <nav className="container-page flex flex-col gap-5 border-t border-white/10 py-6 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end className={navClass}>
                {n.label}
              </NavLink>
            ))}
            <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-solid self-start">
              My Points
            </a>
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
