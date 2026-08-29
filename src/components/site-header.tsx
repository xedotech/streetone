import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SiteHeader({ solid = false }: { solid?: boolean }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border",
        solid ? "bg-bg" : "bg-bg/80 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="font-display text-xl tracking-wide text-fg">
          STREET ONE
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link to="/play" className="hover:text-fg">
            Play
          </Link>
          <Link to="/source" className="hover:text-fg">
            Source
          </Link>
          <a href="/#fund" className="hover:text-fg">
            Fund
          </a>
        </nav>
      </div>
    </header>
  );
}
