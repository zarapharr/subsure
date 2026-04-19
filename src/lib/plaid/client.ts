import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { env } from "@/env";

type PlaidEnvironmentName = "sandbox" | "development" | "production";

const DEFAULT_PRODUCTS: Products[] = [Products.Transactions];
const DEFAULT_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

let cachedPlaidClient: PlaidApi | null = null;

function parseProducts(raw?: string): Products[] {
  if (!raw?.trim()) return DEFAULT_PRODUCTS;

  const productMap: Record<string, Products> = {
    auth: Products.Auth,
    assets: Products.Assets,
    balance: Products.Balance,
    identity: Products.Identity,
    investments: Products.Investments,
    liabilities: Products.Liabilities,
    payment_initiation: Products.PaymentInitiation,
    transactions: Products.Transactions,
    transfer: Products.Transfer,
    signal: Products.Signal,
    statements: Products.Statements,
  };

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase())
    .map((value) => productMap[value])
    .filter((value): value is Products => Boolean(value));

  if (parsed.length === 0) return DEFAULT_PRODUCTS;
  return [...new Set(parsed)];
}

function parseCountryCodes(raw?: string): CountryCode[] {
  if (!raw?.trim()) return DEFAULT_COUNTRY_CODES;

  const countryMap: Record<string, CountryCode> = {
    US: CountryCode.Us,
    CA: CountryCode.Ca,
    GB: CountryCode.Gb,
    FR: CountryCode.Fr,
    ES: CountryCode.Es,
    IE: CountryCode.Ie,
    NL: CountryCode.Nl,
    DE: CountryCode.De,
    IT: CountryCode.It,
    DK: CountryCode.Dk,
    NO: CountryCode.No,
    SE: CountryCode.Se,
    EE: CountryCode.Ee,
    LT: CountryCode.Lt,
    PL: CountryCode.Pl,
    BE: CountryCode.Be,
    PT: CountryCode.Pt,
  };

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toUpperCase())
    .map((value) => countryMap[value])
    .filter((value): value is CountryCode => Boolean(value));

  if (parsed.length === 0) return DEFAULT_COUNTRY_CODES;
  return [...new Set(parsed)];
}

export function getPlaidEnvironment(): PlaidEnvironmentName {
  return env.PLAID_ENV ?? "sandbox";
}

export function getPlaidProducts(): Products[] {
  return parseProducts(env.PLAID_PRODUCTS);
}

export function getPlaidCountryCodes(): CountryCode[] {
  return parseCountryCodes(env.PLAID_COUNTRY_CODES);
}

export function isPlaidConfigured() {
  return Boolean(env.PLAID_CLIENT_ID && env.PLAID_SECRET && getPlaidEnvironment());
}

export function getPlaidClient() {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV.");
  }

  if (cachedPlaidClient) return cachedPlaidClient;

  cachedPlaidClient = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[getPlaidEnvironment()],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID!,
          "PLAID-SECRET": env.PLAID_SECRET!,
        },
      },
    }),
  );

  return cachedPlaidClient;
}
