import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const TIERS = {
  walker: { label: "Spark", amountCents: 900, blurb: "Name in the public CREDITS.md" },
  driver: { label: "Block", amountCents: 2900, blurb: "Credit plus a vote on the next vehicle" },
  captain: {
    label: "District",
    amountCents: 7900,
    blurb: "Named in the engine log. Helps the PC milestone.",
  },
  producer: {
    label: "Foundry",
    amountCents: 24900,
    blurb: "A building on the next map carries your mark.",
  },
} as const;

export type TierId = keyof typeof TIERS;

export const GOAL_CENTS = 2_500_000;
const PRODUCT_ID = process.env.BACHS_PRODUCT_ID || "prod_830a5ed9b2bf4bd7adce";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function bachsBase(key: string) {
  return key.startsWith("sk_live_") ? "https://api.bachs.io" : "https://sandbox-api.bachs.io";
}

function bachsKey() {
  return process.env.BACHS_API_KEY || process.env.BACHS_KEY || "";
}

function publicOrigin(requestOrigin: string) {
  const fallback = process.env.SITE_URL || "https://streetone.vercel.app";
  try {
    const host = new URL(requestOrigin).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.")
    ) {
      return fallback;
    }
    return requestOrigin;
  } catch {
    return fallback;
  }
}

function bachsHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
  };
}

export const getCampaign = createServerFn({ method: "GET" }).handler(async () => {
  return {
    raisedCents: 0,
    backers: 0,
    goalCents: GOAL_CENTS,
    bachsReady: Boolean(bachsKey()),
  };
});

export const startPledge = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tier: z.enum(["walker", "driver", "captain", "producer", "custom"]),
      amountCents: z.number().int().min(300).max(5_000_000),
      email: z.string().email().max(120),
    }),
  )
  .handler(async ({ data }) => {
    const key = bachsKey();
    if (!key) {
      return { ok: false as const, reason: "not_configured" as const };
    }

    const amount = (data.amountCents / 100).toFixed(2);
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    const requestOrigin = getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
    const origin = publicOrigin(requestOrigin);
    const reference = `street-one-${data.tier}-${Date.now()}`;

    const res = await fetch(`${bachsBase(key)}/v1/checkout-sessions`, {
      method: "POST",
      headers: bachsHeaders(key),
      body: JSON.stringify({
        product_cart: [
          {
            product_id: PRODUCT_ID,
            quantity: 1,
            pricing: { price_type: "custom", preset_amount: amount },
          },
        ],
        customer: { email: data.email },
        reference,
        metadata: { app: "street-one", tier: data.tier },
        success_url: `${origin}/thanks`,
        cancel_url: `${origin}/#fund`,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      checkout_id?: string;
      checkout_url?: string;
      error?: { message?: string };
      detail?: string;
      message?: string;
    };

    if (!res.ok || !payload.checkout_url) {
      return {
        ok: false as const,
        reason: "error" as const,
        message:
          payload.detail ||
          payload.error?.message ||
          payload.message ||
          `Bachs returned ${res.status}`,
      };
    }

    return { ok: true as const, url: payload.checkout_url, id: payload.checkout_id };
  });

export const confirmPledge = createServerFn({ method: "POST" })
  .validator(z.object({ checkoutId: z.string().min(3).max(128) }))
  .handler(async ({ data }) => {
    const key = bachsKey();
    if (!key) {
      return { ok: false as const, status: "not_configured" as const };
    }

    const res = await fetch(
      `${bachsBase(key)}/v1/checkout-sessions/${encodeURIComponent(data.checkoutId)}`,
      { headers: bachsHeaders(key) },
    );
    const payload = (await res.json().catch(() => ({}))) as {
      status?: string;
      payment_status?: string;
    };
    const paid =
      payload.status === "completed" && payload.payment_status === "succeeded";

    return {
      ok: true as const,
      status: paid ? ("paid" as const) : ("pending" as const),
    };
  });
