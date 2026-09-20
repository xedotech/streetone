import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public tier catalog (cents). */
export const TIERS = {
  spark: { label: "Spark", amountCents: 900, blurb: "Name in the public CREDITS.md" },
  block: { label: "Block", amountCents: 2900, blurb: "Credit plus a vote on the next vehicle" },
  district: {
    label: "District",
    amountCents: 7900,
    blurb: "Named in the engine log. Helps the PC milestone.",
  },
  foundry: {
    label: "Foundry",
    amountCents: 24900,
    blurb: "A building on the next map carries your mark.",
  },
} as const;

export type TierId = keyof typeof TIERS;

export const GOAL_CENTS = 2_500_000;

// Live Bachs product IDs (Street One store)
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

function readEnv(name: string): string {
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? process.env[name]
      : undefined;
  // Vinxi / Vite SSR sometimes surfaces server secrets here
  const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromMeta = meta?.[name];
  const raw = fromProcess || fromMeta || "";
  return typeof raw === "string" ? raw.trim() : "";
}

function bachsKey() {
  return (
    readEnv("BACHS_API_KEY") ||
    readEnv("BACHS_KEY") ||
    readEnv("BACHS_SECRET_KEY") ||
    readEnv("BACHS_SECRET") ||
    readEnv("BACHS_TOKEN") ||
    readEnv("BACHS_LIVE_KEY") ||
    ""
  );
}

function bachsKeyProbe(): string {
  const names = [
    "BACHS_API_KEY",
    "BACHS_KEY",
    "BACHS_SECRET_KEY",
    "BACHS_SECRET",
    "BACHS_TOKEN",
    "BACHS_LIVE_KEY",
  ];
  const present = names.filter((n) => Boolean(readEnv(n)));
  // Also note any env key that looks Bachs-related (names only, never values)
  const allKeys =
    typeof process !== "undefined" && process.env
      ? Object.keys(process.env)
      : [];
  const related = allKeys.filter((k) => /bachs/i.test(k));
  return `present=[${present.join(",") || "none"}] related=[${related.join(",") || "none"}]`;
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

function bachsHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
  };
}

/** Map UI tier ids (and legacy aliases) → Bachs product. */
function productForTier(tier: string): { productId: string; customAmount: boolean } {
  if (tier === "spark" || tier === "walker") return { productId: SPARK_ID, customAmount: false };
  if (tier === "block" || tier === "driver") return { productId: BLOCK_ID, customAmount: false };
  if (tier === "foundry" || tier === "producer") return { productId: FOUNDRY_ID, customAmount: false };
  // district / captain / custom / open fund → flexible-amount product
  return { productId: OPEN_FUND_ID, customAmount: true };
}

type BachsCheckoutPayload = {
  checkout_id?: string;
  checkout_url?: string;
  checkoutUrl?: string;
  url?: string;
  error?: { message?: string };
  detail?: string;
  message?: string;
  error_code?: string;
};

function pickCheckoutUrl(payload: BachsCheckoutPayload): string | undefined {
  const raw = payload.checkout_url || payload.checkoutUrl || payload.url;
  return typeof raw === "string" && raw.startsWith("http") ? raw : undefined;
}

function explainBachs(status: number, payload: BachsCheckoutPayload, rawText: string): string {
  const fromJson =
    payload.detail ||
    payload.error?.message ||
    payload.message ||
    (payload.error_code ? `Bachs ${payload.error_code}` : "");
  if (fromJson) return fromJson;
  const snippet = rawText.replace(/\s+/g, " ").slice(0, 180);
  if (snippet) return `Bachs ${status}: ${snippet}`;
  return `Bachs returned ${status} with empty body`;
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
      tier: z.enum([
        "spark",
        "block",
        "district",
        "foundry",
        "custom",
        // legacy aliases still used by some clients
        "walker",
        "driver",
        "captain",
        "producer",
      ]),
      amountCents: z.number().int().min(300).max(5_000_000),
      email: z.string().email().max(120),
    }),
  )
  .handler(async ({ data }) => {
    const key = bachsKey();
    if (!key) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message: `Bachs API key missing on server (${bachsKeyProbe()})`,
      };
    }

    const amount = (data.amountCents / 100).toFixed(2);
    const origin = await resolveOrigin();
    const reference = `street-one-${data.tier}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { productId, customAmount } = productForTier(data.tier);
    const lineItem: Record<string, unknown> = {
      product_id: productId,
      quantity: 1,
    };
    // Always send amount — open-fund needs it; fixed tiers accept matching unit amount
    lineItem.amount = amount;

    const requestBody = {
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
        product_id: productId,
        custom_amount: String(customAmount),
      },
      success_url: `${origin}/thanks`,
      cancel_url: `${origin}/#fund`,
      billing_currency: "USD",
    };

    let res: Response;
    let rawText = "";
    try {
      res = await fetch(`${bachsBase(key)}/v1/checkout-sessions`, {
        method: "POST",
        headers: bachsHeaders(key),
        body: JSON.stringify(requestBody),
      });
      rawText = await res.text();
    } catch (err) {
      return {
        ok: false as const,
        reason: "error" as const,
        message: err instanceof Error ? `Reach Bachs failed: ${err.message}` : "Could not reach Bachs",
      };
    }

    let payload: BachsCheckoutPayload = {};
    try {
      payload = JSON.parse(rawText) as BachsCheckoutPayload;
    } catch {
      payload = {};
    }
    const url = pickCheckoutUrl(payload);

    if (!res.ok || !url) {
      return {
        ok: false as const,
        reason: "error" as const,
        message: explainBachs(res.status, payload, rawText),
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
