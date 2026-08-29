import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Gamepad2, GitFork, Monitor } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCampaign, startPledge, TIERS, type TierId } from "@/lib/campaign";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
  loader: () => getCampaign(),
});

const STRETCH = [
  {
    at: 25_000,
    title: "Keep the proof public",
    body: "The street you can play today stays free. Bugfixes, source, credits for every Spark.",
  },
  {
    at: 80_000,
    title: "A district, not a street",
    body: "Connected blocks, alleys, a garage, more AI. Same engine. More city.",
  },
  {
    at: 250_000,
    title: "Native PC",
    body: "Windows and Linux builds from the Godot project. More vehicles, weapons, and systems.",
  },
  {
    at: 750_000,
    title: "Consoles and online",
    body: "First-party export path, pad-first controls, drop-in sessions. Store approval is earned, not assumed.",
  },
];

function Home() {
  const initial = Route.useLoaderData();
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState("25");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getCampaign().then(setStats);
  }, []);

  const pct = Math.min(100, (stats.raisedCents / stats.goalCents) * 100);

  async function donate(tier: TierId | "custom", amountCents: number) {
    setNotice(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNotice("Bachs needs an email for the receipt. Add it above the amounts.");
      return;
    }
    setBusy(tier);
    try {
      const res = await startPledge({ data: { tier, amountCents, email: trimmed } });
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      if (res.reason === "not_configured") {
        setNotice(
          "Bachs is wired, but the live API key is not in this environment yet. Send the key and donations go live — nothing else to rebuild.",
        );
      } else {
        setNotice(res.message || "Checkout failed.");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_0.8fr] md:py-16">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">
                Free forever · MIT · Open funded
              </p>
              <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-wide text-fg md:text-7xl">
                STREET
                <br />
                ONE
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
                A free, open-source game with the long ambition of the closed blockbusters — city, guns, vehicles, PC, then consoles. This street is the proof. Play it. If it hits, help us reach the target.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/play">Play free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#fund">Donate</a>
                </Button>
              </div>
            </div>
            <Card className="self-start">
              <p className="text-xs uppercase tracking-widest text-muted">Open fund</p>
              <p className="mt-2 font-display text-4xl tabular-nums text-fg">
                ${(stats.raisedCents / 100).toLocaleString()}
              </p>
              <p className="text-sm text-muted">
                donated of ${(stats.goalCents / 100).toLocaleString()} first target · {stats.backers}{" "}
                donors
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-4 text-sm text-muted">
                The game is free. Money is optional. Donations settle through Bachs — cards, mobile money, bank, USDT/USDC.
              </p>
              <Button className="mt-5 w-full" asChild>
                <a href="#fund">Help hit the target</a>
              </Button>
              {!stats.bachsReady && (
                <p className="mt-3 text-xs text-muted">
                  Checkout is waiting on a Bachs API key. The page is ready.
                </p>
              )}
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="font-display text-3xl tracking-wide text-fg">See what we can do</h2>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
            <p>
              Closed studios spend a decade and a billion dollars before you touch the stick. Street One ships the opposite: a playable street, tonight, source in the zip, no store, no season pass.
            </p>
            <p>
              The north star is a free game at the scale people actually want — an open city, a gun that works, cars you can steal the night with, built in public until it stands next to the commercial giants on PC and, with enough runway, consoles. We are not those games. We are the open alternative, started from one block.
            </p>
            <p>
              This cut is AI-built and community-owned. MIT. If the money never comes, the street still compiles. If it does, we spend it on map, systems, native PC, then the console path — in that order, in public.
            </p>
          </div>
        </section>

        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-3">
            {[
              {
                icon: Gamepad2,
                t: "Playable tonight",
                d: "Drive, hop out, shoot. Six AI. One night street. Free in the browser.",
              },
              {
                icon: GitFork,
                t: "Forever open source",
                d: "Godot 4 is the canonical game. Fork it, patch it, export it. No studio can lock the repo.",
              },
              {
                icon: Monitor,
                t: "PC now, consoles later",
                d: "Web demo today. Native Windows/Linux is a funded milestone. Consoles need licenses and a real build — we will not fake a store date.",
              },
            ].map((item) => (
              <div key={item.t} className="rounded-[var(--radius-lg)] border border-border bg-bg p-5">
                <item.icon className="size-5 text-primary" strokeWidth={1.75} />
                <h3 className="mt-3 font-display text-xl tracking-wide text-fg">{item.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="font-display text-3xl tracking-wide text-fg">What you can play right now</h2>
          <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-muted">
            <li>One sodium-lit city street, facing buildings, parked cars, a driveable sedan.</li>
            <li>Arcade car: W throttle, S brake, A left, D right. F to hop out.</li>
            <li>On-foot pistol vs six simple AI who chase and return fire. Clear the block or drop.</li>
            <li>That is the proof. Not a trailer. Not a city we have not built.</li>
          </ul>
          <Button className="mt-6" asChild>
            <Link to="/play">Start the demo</Link>
          </Button>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-display text-3xl tracking-wide text-fg">The public target</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Donations are not a pre-order. The game is already free. Hitting a line item below is how we choose what to build next.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {STRETCH.map((s) => (
              <Card key={s.title} className="p-5">
                <p className="text-xs tabular-nums text-muted">${s.at.toLocaleString()}</p>
                <CardTitle className="mt-1">{s.title}</CardTitle>
                <CardDesc>{s.body}</CardDesc>
              </Card>
            ))}
          </div>
        </section>

        <section id="fund" className="border-t border-border bg-surface/30">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="font-display text-3xl tracking-wide text-fg">Donate</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              One-time. No subscription. No paywall. Bachs handles tax, FX, and settlement. We never store your card here — only the email Bachs needs for the receipt.
            </p>
            <label className="mt-6 block max-w-md text-sm text-muted">
              Receipt email
              <Input
                className="mt-2"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(TIERS) as TierId[]).map((id) => {
                const t = TIERS[id];
                return (
                  <Card key={id} className="flex flex-col p-5">
                    <p className="text-xs uppercase tracking-widest text-muted">{t.label}</p>
                    <p className="mt-1 font-display text-3xl text-fg">${(t.amountCents / 100).toFixed(0)}</p>
                    <p className="mt-2 flex-1 text-sm text-muted">{t.blurb}</p>
                    <Button
                      className="mt-5 w-full"
                      disabled={busy !== null}
                      onClick={() => void donate(id, t.amountCents)}
                    >
                      {busy === id ? "Opening Bachs…" : "Donate"}
                    </Button>
                  </Card>
                );
              })}
            </div>
            <Card className="mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm text-muted">
                Any amount (USD)
                <Input
                  className="mt-2"
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </label>
              <Button
                disabled={busy !== null}
                onClick={() => {
                  const n = Math.round(Number(custom) * 100);
                  if (!Number.isFinite(n) || n < 300) {
                    setNotice("Minimum donation is $3.");
                    return;
                  }
                  void donate("custom", n);
                }}
              >
                {busy === "custom" ? "Opening Bachs…" : "Donate custom"}
              </Button>
            </Card>
            {notice && (
              <p className={cn("mt-4 text-sm", stats.bachsReady ? "text-danger" : "text-muted")}>
                {notice}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="font-display text-3xl tracking-wide text-fg">Said plainly</h2>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
            <p>
              We have one street, arcade handling, and simple AI. We have not built a city, a live-service shooter, or a console SKU. Naming the closed giants is the ambition, not a feature list we already shipped.
            </p>
            <p>
              Console ports need first-party licenses and a passing build. PC natives are closer — they come out of this same Godot project. If a target misses, unspent money stays on the next public line.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <a href="/street-one-godot.zip">
                <Download className="size-4" />
                Download Godot repo
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/source">Browse source</Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted">
        Street One · Free · MIT · Open funded via Bachs
      </footer>
    </div>
  );
}
