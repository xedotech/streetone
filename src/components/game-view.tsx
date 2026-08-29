import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { mountStreetOne, type HudState, type StreetOneHandle } from "@/game/street-one";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY: HudState = {
  hp: 100,
  ammo: 36,
  inCar: true,
  speedKph: 0,
  enemiesLeft: 6,
  enemiesTotal: 6,
  wanted: false,
  outcome: "play",
  prompt: "Start",
  hitmarker: false,
};

export function GameView({ autoStart = false }: { autoStart?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<StreetOneHandle | null>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudState>(EMPTY);
  const [started, setStarted] = useState(autoStart);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountStreetOne(canvas, {
      onHud: setHud,
      autoStart,
    });
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [autoStart]);

  function start() {
    handleRef.current?.start();
    setStarted(true);
  }

  function onStick(clientX: number, clientY: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (clientX - cx) / (rect.width / 2);
    let y = (clientY - cy) / (rect.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setKnob({ x, y });
    handleRef.current?.setTouch({ moveX: x, moveY: -y });
  }

  return (
    <div className="relative h-full min-h-[100dvh] w-full overflow-hidden bg-bg touch-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
      />

      {started && hud.outcome === "play" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-2">
              <p className="font-display text-lg tracking-wide text-fg">STREET ONE</p>
              <p className="text-xs text-muted">{hud.inCar ? "Driving" : "On foot"}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="rounded-full border border-border bg-bg/80 px-3 py-1 text-xs tabular-nums text-fg">
                {Math.round(hud.speedKph)} km/h
              </div>
              <div className="rounded-full border border-border bg-bg/80 px-3 py-1 text-xs tabular-nums text-fg">
                {hud.enemiesLeft}/{hud.enemiesTotal} live
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <span
              className={cn(
                "size-1.5 rounded-full",
                hud.hitmarker ? "bg-fg" : "bg-fg/50",
              )}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-lg items-end justify-between gap-3">
              <div className="min-w-36">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted">Health</p>
                <div className="h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      hud.hp < 30 ? "bg-danger" : "bg-primary",
                    )}
                    style={{ width: `${hud.hp}%` }}
                  />
                </div>
                {!hud.inCar && (
                  <p className="mt-2 text-xs tabular-nums text-muted">{hud.ammo} rnd</p>
                )}
              </div>
              <p className="max-w-48 text-right text-[11px] leading-snug text-muted">
                {hud.prompt}
              </p>
            </div>
          </div>

          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 md:hidden">
            <div
              ref={stickRef}
              className="relative size-28 rounded-full border border-border bg-surface/70"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                onStick(e.clientX, e.clientY, e.currentTarget);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  onStick(e.clientX, e.clientY, e.currentTarget);
                }
              }}
              onPointerUp={(e) => {
                setKnob({ x: 0, y: 0 });
                handleRef.current?.setTouch({ moveX: 0, moveY: 0 });
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                setKnob({ x: 0, y: 0 });
                handleRef.current?.setTouch({ moveX: 0, moveY: 0 });
              }}
            >
              <div
                className="absolute size-10 rounded-full bg-primary/90"
                style={{
                  left: `calc(50% + ${knob.x * 36}px - 20px)`,
                  top: `calc(50% + ${knob.y * 36}px - 20px)`,
                }}
              />
            </div>
          </div>

          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 flex flex-col gap-2 md:hidden">
            <button
              type="button"
              className="size-14 rounded-full border border-border bg-surface/80 text-xs font-medium text-fg"
              onPointerDown={() => handleRef.current?.setTouch({ enter: true })}
            >
              F
            </button>
            <button
              type="button"
              className="size-16 rounded-full bg-primary text-sm font-medium text-bg"
              onPointerDown={() => handleRef.current?.setTouch({ fire: true })}
              onPointerUp={() => handleRef.current?.setTouch({ fire: false })}
              onPointerCancel={() => handleRef.current?.setTouch({ fire: false })}
            >
              Fire
            </button>
          </div>
        </>
      )}

      {(!started || hud.outcome !== "play") && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/70 p-6">
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center">
            <p className="font-display text-4xl tracking-wide text-fg">STREET ONE</p>
            <p className="mt-2 text-sm text-muted">
              {hud.outcome === "win"
                ? "The block is quiet. You cleared it."
                : hud.outcome === "lose"
                  ? "You went down on the asphalt."
                  : "Free open-source demo. Drive. Shoot. See what we can do."}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (!started || hud.outcome === "play") start();
                  else {
                    handleRef.current?.restart();
                    setStarted(true);
                  }
                }}
              >
                {hud.outcome === "play" ? "Start" : "Play again"}
              </Button>
              <Button variant="outline" size="lg" className="w-full" asChild>
                <Link to="/">The fund</Link>
              </Button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              W throttle · S brake · A left · D right · F enter/exit · Space fire
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
