import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns ok with version + uptime", () => {
    const controller = new HealthController();
    const res = controller.get();

    expect(res.status).toBe("ok");
    expect(res.service).toBe("api");
    expect(typeof res.version).toBe("string");
    expect(res.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(() => new Date(res.timestamp)).not.toThrow();
  });
});
