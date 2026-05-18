import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseApiClient } from "./supabase-adapter";
import { ApiError } from "./client";

/**
 * Hand-rolled Supabase client mock. `from(table)` returns a chainable builder
 * whose terminal methods (`single`, or the awaited `insert` for member rows)
 * resolve with a configurable `{data, error}` result. Every call is recorded
 * so the test can assert the payloads the adapter sent.
 */
interface Call {
  table: string;
  insert?: unknown;
  select?: string;
  single?: boolean;
}

function makeMockSb(opts: {
  conversationResult: { data: unknown; error: unknown };
  membersResult: { error: unknown };
}) {
  const calls: Call[] = [];

  function builderFor(table: string): Record<string, unknown> {
    const call: Call = { table };
    calls.push(call);

    if (table === "conversations") {
      const builder: Record<string, unknown> = {};
      builder.insert = (payload: unknown) => {
        call.insert = payload;
        return builder;
      };
      builder.select = (cols: string) => {
        call.select = cols;
        return builder;
      };
      builder.single = async () => {
        call.single = true;
        return opts.conversationResult;
      };
      return builder;
    }

    // conversation_members: insert is the awaited terminal.
    const builder: Record<string, unknown> = {};
    builder.insert = (payload: unknown) => {
      call.insert = payload;
      return Promise.resolve(opts.membersResult);
    };
    return builder;
  }

  const sb = {
    from: (table: string) => builderFor(table),
  } as unknown as SupabaseClient;

  return { sb, calls };
}

const conversationRow = {
  id: "conv-1",
  kind: "group",
  title: "Issue #42 chat",
  last_message_at: null,
};

describe("SupabaseApiClient.createConversation", () => {
  it("inserts the conversation with kind+title and selects the right columns", async () => {
    const { sb, calls } = makeMockSb({
      conversationResult: { data: conversationRow, error: null },
      membersResult: { error: null },
    });
    const client = new SupabaseApiClient(sb, "leader-1");

    await client.createConversation({
      kind: "group",
      title: "Issue #42 chat",
      memberIds: ["leader-1", "writer-1"],
    });

    const convCall = calls.find((c) => c.table === "conversations")!;
    expect(convCall.insert).toEqual({ kind: "group", title: "Issue #42 chat" });
    expect(convCall.select).toBe("id, kind, title, last_message_at");
    expect(convCall.single).toBe(true);
  });

  it("inserts one member row per memberId", async () => {
    const { sb, calls } = makeMockSb({
      conversationResult: { data: conversationRow, error: null },
      membersResult: { error: null },
    });
    const client = new SupabaseApiClient(sb, "leader-1");

    await client.createConversation({
      kind: "group",
      title: "Issue #42 chat",
      memberIds: ["leader-1", "writer-1", "editor-1"],
    });

    const memberCall = calls.find((c) => c.table === "conversation_members")!;
    expect(memberCall.insert).toEqual([
      { conversation_id: "conv-1", user_id: "leader-1" },
      { conversation_id: "conv-1", user_id: "writer-1" },
      { conversation_id: "conv-1", user_id: "editor-1" },
    ]);
  });

  it("returns the conversation in the contract shape", async () => {
    const { sb } = makeMockSb({
      conversationResult: {
        data: { ...conversationRow, last_message_at: "2026-05-18T00:00:00Z" },
        error: null,
      },
      membersResult: { error: null },
    });
    const client = new SupabaseApiClient(sb, "leader-1");

    const result = await client.createConversation({
      kind: "group",
      title: "Issue #42 chat",
      memberIds: ["leader-1", "writer-1"],
    });

    expect(result).toEqual({
      id: "conv-1",
      kind: "group",
      title: "Issue #42 chat",
      memberIds: ["leader-1", "writer-1"],
      lastMessageAt: "2026-05-18T00:00:00Z",
    });
  });

  it("throws ApiError when the conversation insert fails", async () => {
    const { sb } = makeMockSb({
      conversationResult: { data: null, error: { message: "insert denied" } },
      membersResult: { error: null },
    });
    const client = new SupabaseApiClient(sb, "leader-1");

    await expect(
      client.createConversation({
        kind: "group",
        title: "x",
        memberIds: ["leader-1"],
      })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError when the member insert fails", async () => {
    const { sb } = makeMockSb({
      conversationResult: { data: conversationRow, error: null },
      membersResult: { error: { message: "members denied" } },
    });
    const client = new SupabaseApiClient(sb, "leader-1");

    await expect(
      client.createConversation({
        kind: "group",
        title: "x",
        memberIds: ["leader-1"],
      })
    ).rejects.toBeInstanceOf(ApiError);
  });
});
