import { describe, expect, it } from "vitest";
import { centrePhone, telHref } from "@/models/phones";

describe("centrePhone", () => {
  it("prefers the centre's own line, else what the City sent", () => {
    expect(centrePhone({ id: 240, phone: "(905) 615-4100" })).toBe("905-615-4840");
    expect(centrePhone({ id: 999999, phone: " (905)  615-4100 " })).toBe("(905) 615-4100");
    expect(centrePhone({ phone: null })).toBe("");
    expect(centrePhone(undefined)).toBe("");
  });
});

describe("telHref", () => {
  it("keeps digits, and dials an extension after a pause", () => {
    expect(telHref("905-615-4840")).toBe("tel:9056154840");
    expect(telHref("(905) 615-4100")).toBe("tel:9056154100");
    expect(telHref("905-615-3200 ext 2895")).toBe("tel:9056153200,2895");
    expect(telHref("905-615-3200 Ext. 2895")).toBe("tel:9056153200,2895");
  });
});
