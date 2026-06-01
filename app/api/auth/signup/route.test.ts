import { describe, expect, it } from "vitest";
import { POST } from "./route";
import type { NextRequest } from "next/server";

function reqWith(body: unknown): NextRequest {
  // The validation-failure path only touches req.json(), so a light stub
  // is enough — no Supabase/mailer mocking required.
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/auth/signup — role validation", () => {
  const base = {
    name: "Alex Rivera",
    email: "alex@advantage.org",
    password: "supersecret",
  };

  it("rejects a self-selected elevated role (admin)", async () => {
    const res = await POST(reqWith({ ...base, role: "admin" }));
    expect(res.status).toBe(400);
  });

  it("rejects a self-selected elevated role (leader)", async () => {
    const res = await POST(reqWith({ ...base, role: "leader" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown role value", async () => {
    const res = await POST(reqWith({ ...base, role: "superuser" }));
    expect(res.status).toBe(400);
  });
});
