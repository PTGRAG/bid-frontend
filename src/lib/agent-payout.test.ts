import { describe, expect, it } from "vitest";
import { formatPayoutAccount, payoutMethodKey } from "./agent-payout";

describe("formatPayoutAccount", () => {
  it("shows mobile money numbers in international groups", () => {
    expect(formatPayoutAccount({ method: "telebirr", account: "251911223344" })).toBe("+251 911 223 344");
    expect(formatPayoutAccount({ method: "mpesa", account: "251711223344" })).toBe("+251 711 223 344");
  });

  it("groups bank numbers in fours", () => {
    expect(formatPayoutAccount({ method: "bank", account: "1000123456789" })).toBe("1000 1234 5678 9");
  });

  it("does not treat a bank number that starts with 251 as a phone", () => {
    expect(formatPayoutAccount({ method: "bank", account: "251911223344" })).toBe("2519 1122 3344");
  });
});

describe("payoutMethodKey", () => {
  it("maps each method to its label key", () => {
    expect(payoutMethodKey("telebirr")).toBe("payoutMethodTelebirr");
    expect(payoutMethodKey("cbe_birr")).toBe("payoutMethodCbeBirr");
    expect(payoutMethodKey("mpesa")).toBe("payoutMethodMpesa");
    expect(payoutMethodKey("bank")).toBe("payoutMethodBank");
    expect(payoutMethodKey("something")).toBe("payoutMethodBank");
  });
});
