import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/source")({
  component: SourcePage,
  head: () => ({
    meta: [
      { title: "Street One source — MIT" },
      { name: "description", content: "Download the Street One Lagos browser city and the Godot street slice. MIT." },
    ],
    links: [{ rel: "canonical", href: "https://streetone.grok.me/source" }],
  }),
});

const FILES = [
  { path: "project.godot", note: "Godot 4.3+ project" },
  { path: "scenes/main.tscn", note: "Entry scene" },
  { path: "scripts/game.gd", note: "Street, loop, win/lose" },
  { path: "scripts/player.gd", note: "On-foot + enter/exit" },
  { path: "scripts/car.gd", note: "Arcade drive, A left / D right" },
  { path: "scripts/enemy.gd", note: "Patrol, chase, shoot" },
  { path: "scripts/hud.gd", note: "HP, ammo, prompts" },
  { path: "OPEN-FUND.md", note: "Public fund copy" },
  { path: "LICENSE", note: "MIT — the game is free" },
  { path: "README.md", note: "Run, export, contribute" },
];

function SourcePage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Open source</p>
        <h1 className="mt-2 font-display text-5xl tracking-wide text-fg">Source</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Street One is free. Two trees ship with the site: the Lagos browser city you play tonight, and the original Godot 4 street slice. Fork either. Donations are optional.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href="/city-source.zip">Download city .zip</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/street-one-godot.zip">Download Godot slice</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://github.com/xedotech/streetone" target="_blank" rel="noreferrer">GitHub</a>
          </Button>
        </div>
        <Card className="mt-8 p-0">
          <ul className="divide-y divide-border">
            {FILES.map((f) => (
              <li key={f.path} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <a
                  className="font-mono text-sm text-fg hover:underline"
                  href={`/godot/${f.path}`}
                >
                  {f.path}
                </a>
                <span className="text-xs text-muted">{f.note}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
