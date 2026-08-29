import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmPledge } from "@/lib/campaign";

export const Route = createFileRoute("/thanks")({
  validateSearch: (s: Record<string, unknown>) => ({
    checkout_id: typeof s.checkout_id === "string" ? s.checkout_id : undefined,
    checkoutId: typeof s.checkoutId === "string" ? s.checkoutId : undefined,
  }),
  component: ThanksPage,
});

function ThanksPage() {
  const search = Route.useSearch();
  const id = search.checkout_id || search.checkoutId;
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "missing">("checking");

  useEffect(() => {
    if (!id) {
      setStatus("missing");
      return;
    }
    void confirmPledge({ data: { checkoutId: id } }).then((res) => {
      if ("status" in res && res.status === "paid") setStatus("paid");
      else setStatus("pending");
    });
  }, [id]);

  const paid = status === "paid";
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="mx-auto flex max-w-lg flex-col px-4 py-16">
        <Card className="text-center">
          <p className="font-display text-4xl tracking-wide text-fg">
            {status === "checking" ? "Checking Bachs…" : paid ? "Thank you" : "Donation received"}
          </p>
          <p className="mt-3 text-sm text-muted">
            {status === "checking"
              ? "Confirming the checkout with Bachs."
              : paid
                ? "Bachs marked this paid. The game stays free. Your donation pushes the public target."
                : "If you just paid, Bachs may still be settling. Refresh in a moment or check your Bachs receipt."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link to="/play">Play the demo</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to the fund</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
