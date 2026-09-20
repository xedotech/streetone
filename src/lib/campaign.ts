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

const OPEN_FUND_ID =
  process.env.BACHS_PRODUCT_ID?.trim() || "prod_830a5ed9b2bf4bd7adce";
const SPARK_ID =
  process.env.BACHS_PRODUCT_SPARK?.trim() || "prod_d155e12f0a2a45f19cf7";
const BLOCK_ID =
  process.env.BACHS_PRODUCT_BLOCK?.trim() || "prod_59588492eb42480e9875";
const FOUNDRY_ID =
  process.env.BACHS_PRODUCT_FOUNDRY?.trim() || "prod_664f558eee63473b8458";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function bachsBase(key: string) {
  return key.startsWith("sk_live_")
    ? "https://api.bachs.io"
    : process.env.BACHS_API_BASE?.trim() || "https://sandbox-api.bachs.io";
}

function bachsKey() {
  return (
    process.env.BACHS_API_KEY?.trim() ||
    process.env.BACHS_KEY?.trim() ||
    process.env.BACHS_SECRET_KEY?.trim() ||
    ""
  );
}

function publicOrigin(requestOrigin: string) {
  const fallback =
    process.env.SITE_URL?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    "https://streetone.grok.me";
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

function productForTier(tier: string): { productId: string; customAmount: boolean } {
  if (tier === "walker") return { productId: SPARK_ID, customAmount: false };
  if (tier === "driver") return { productId: BLOCK_ID, customAmount: false };
  if (tier === "producer") return { productId: FOUNDRY_ID, customAmount: false };
  return { productId: OPEN_FUND_ID, customAmount: true };
}

type BachsCheckoutPayload = {
  checkout_id?: string;
  checkout_url?: string;
  url?: string;
  error?: { message?: string };
  detail?: string;
  message?: string;
};

function pickCheckoutUrl(payload: BachsCheckoutPayload): string | undefined {
  const raw = payload.checkout_url || payload.url;
  return typeof raw === "string" && raw.startsWith("http") ? raw : undefined;
}

async function resolveOrigin(): Promise<string> {
  const fallback = "https://streetone.grok.me";
  try {
    const mod = await import("@tanstack/react-start/server");
    const getUrl =
      (mod as { getRequestUrl?: Function }).getRequestUrl ||
      (mod as { getRequestURL?: Function }).getRequestURL;
    if (typeof getUrl === "function") {
      return publicOrigin(
        getUrl({ xForwardedHost: true, xForwardedProto: true }).origin,
      );
    }
  } catch {
    /* ignore */
  }
  return publicOrigin(fallback);
}

export const getCampaign = createServerFn({ method: "GET" }).handler(async () => {
  const ready = Boolean(bachsKey());
  return {
    raisedCents: 0,
    backers: 0,
    goalCents: GOAL_CENTS,
    bachsReady: ready,
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
    const origin = await resolveOrigin();
    const reference = `street-one-${data.tier}-${Date.now()}`;
    const { productId, customAmount } = productForTier(data.tier);
    const lineItem: Record<string, unknown> = {
      product_id: productId,
      quantity: 1,
    };
    if (customAmount) {
      lineItem.amount = amount;
    }

    let res: Response;
    try {
      res = await fetch(`${bachsBase(key)}/v1/checkout-sessions`, {
        method: "POST",
        headers: bachsHeaders(key),
        body: JSON.stringify({
          product_cart: [lineItem],
          customer: {
            email: data.email,
            name: data.email.split("@")[0] || "Donor",
          },
          reference,
          metadata: {
            app: "street-one",
            tier: data.tier,
            amount_cents: String(data.amountCents),
          },
          success_url: `${origin}/thanks`,
          cancel_url: `${origin}/#fund`,
          billing_currency: "USD",
          payment_method_options: { card: { currencies: ["USD"] } },
        }),
      });
    } catch (err) {
      return {
        ok: false as const,
        reason: "error" as const,
        message: err instanceof Error ? err.message : "Could not reach Bachs",
      };
    }

    const payload = (await res.json().catch(() => ({}))) as BachsCheckoutPayload;
    const url = pickCheckoutUrl(payload);

    if (!res.ok || !url) {
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

    return { ok: true as const, url, id: payload.checkout_id };
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
