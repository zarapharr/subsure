import { describe, expect, it } from "vitest";
import {
  groupDescriptorsByCanonicalName,
  normalizeMerchantDescriptor,
} from "@/lib/merchant-normalization";

describe("merchant normalization", () => {
  it("maps known merchant aliases to canonical names", () => {
    const spotify = normalizeMerchantDescriptor("SPOTIFY USA 877-778-1161 NY");
    const netflix = normalizeMerchantDescriptor("NETFLIX.COM 408-540-3700 CA");
    const amazon = normalizeMerchantDescriptor("AMZN Mktp US*2A3B4C5D6 Amzn.com/bill WA");

    expect(spotify.canonicalName).toBe("spotify");
    expect(spotify.displayName).toBe("Spotify");
    expect(spotify.confidenceBand).toBe("high");

    expect(netflix.canonicalName).toBe("netflix");
    expect(amazon.canonicalName).toBe("amazon");
  });

  it("falls back to token-derived merchant names when no rule matches", () => {
    const result = normalizeMerchantDescriptor("PAYPAL *ACME VIDEO SERVICES 8001234567 TX");

    expect(result.canonicalName).toBe("paypal_acme_video");
    expect(result.displayName).toBe("Paypal Acme Video");
    expect(result.confidenceBand).toBe("medium");
    expect(result.cleanedDescriptor).toContain("PAYPAL");
  });

  it("returns unknown merchant when descriptor has no signal", () => {
    const result = normalizeMerchantDescriptor("1234 5678 9012");

    expect(result.canonicalName).toBe("unknown_merchant");
    expect(result.displayName).toBe("Unknown Merchant");
    expect(result.confidenceBand).toBe("low");
    expect(result.cleanedDescriptor).toBe("");
  });

  it("groups raw descriptors by canonical merchant key", () => {
    const grouped = groupDescriptorsByCanonicalName([
      "SPOTIFY USA 877-778-1161 NY",
      "Spotify P123456789",
      "NETFLIX.COM 408-540-3700 CA",
    ]);

    expect(Object.keys(grouped).sort()).toEqual(["netflix", "spotify"]);
    expect(grouped.spotify).toHaveLength(2);
    expect(grouped.netflix).toHaveLength(1);
  });
});
