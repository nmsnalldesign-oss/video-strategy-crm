import test from "node:test";
import assert from "node:assert/strict";

import {
  createIdea,
  filterIdeas,
  getBoardSummary,
  normalizeSyncSettings,
  parseBoard,
  serializeBoard,
  updateIdeaStatus
} from "../public/app-core.mjs";

const fixedNow = () => "2026-06-19T00:00:00.000Z";
const fixedId = () => "idea-fixed";

test("createIdea trims fields and fills defaults", () => {
  const idea = createIdea(
    {
      title: "  Night ride hook  ",
      referenceUrl: " https://instagram.com/reel/example ",
      track: "  synth track ",
      script: "  Open on a street light ",
      notes: "  Shoot after sunset ",
      assignee: "  Vanya ",
      attachments: [{ name: "frame.png", dataUrl: "data:image/png;base64,abc" }]
    },
    { now: fixedNow, makeId: fixedId }
  );

  assert.equal(idea.id, "idea-fixed");
  assert.equal(idea.title, "Night ride hook");
  assert.equal(idea.referenceUrl, "https://instagram.com/reel/example");
  assert.equal(idea.track, "synth track");
  assert.equal(idea.status, "idea");
  assert.equal(idea.createdAt, "2026-06-19T00:00:00.000Z");
  assert.equal(idea.updatedAt, "2026-06-19T00:00:00.000Z");
  assert.equal(idea.attachments.length, 1);
});

test("createIdea requires a title or reference link", () => {
  assert.throws(
    () => createIdea({ title: " ", referenceUrl: " " }, { now: fixedNow, makeId: fixedId }),
    /title or reference/i
  );
});

test("updateIdeaStatus changes only allowed statuses", () => {
  const idea = createIdea({ title: "Test idea" }, { now: fixedNow, makeId: fixedId });
  const updated = updateIdeaStatus(idea, "landed", { now: () => "2026-06-20T00:00:00.000Z" });

  assert.equal(updated.status, "landed");
  assert.equal(updated.updatedAt, "2026-06-20T00:00:00.000Z");
  assert.throws(() => updateIdeaStatus(idea, "done"), /unknown status/i);
});

test("filterIdeas supports search and status", () => {
  const first = createIdea({ title: "Car reel", track: "fast beat" }, { now: fixedNow, makeId: () => "1" });
  const second = createIdea({ title: "Cafe sketch", script: "slow zoom" }, { now: fixedNow, makeId: () => "2" });
  const tried = updateIdeaStatus(second, "tried", { now: fixedNow });

  assert.deepEqual(filterIdeas([first, tried], { search: "zoom" }).map((idea) => idea.id), ["2"]);
  assert.deepEqual(filterIdeas([first, tried], { status: "tried" }).map((idea) => idea.id), ["2"]);
});

test("getBoardSummary counts statuses and success rate", () => {
  const base = createIdea({ title: "One" }, { now: fixedNow, makeId: () => "1" });
  const landed = updateIdeaStatus(createIdea({ title: "Two" }, { now: fixedNow, makeId: () => "2" }), "landed", { now: fixedNow });
  const missed = updateIdeaStatus(createIdea({ title: "Three" }, { now: fixedNow, makeId: () => "3" }), "missed", { now: fixedNow });

  const summary = getBoardSummary([base, landed, missed]);

  assert.equal(summary.total, 3);
  assert.equal(summary.byStatus.idea, 1);
  assert.equal(summary.byStatus.landed, 1);
  assert.equal(summary.byStatus.missed, 1);
  assert.equal(summary.successRate, 50);
});

test("serializeBoard and parseBoard preserve ideas safely", () => {
  const idea = createIdea({ title: "Export me" }, { now: fixedNow, makeId: fixedId });
  const serialized = serializeBoard([idea]);
  const parsed = parseBoard(serialized);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Export me");
  assert.throws(() => parseBoard("{bad json"), /could not parse/i);
});

test("normalizeSyncSettings supports Supabase and Firebase modes", () => {
  assert.deepEqual(
    normalizeSyncSettings({
      provider: "supabase",
      roomId: "  vanya-strategy ",
      supabaseUrl: " https://example.supabase.co ",
      supabaseAnonKey: " anon-key "
    }),
    {
      provider: "supabase",
      roomId: "vanya-strategy",
      firebaseConfigText: "",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key"
    }
  );

  assert.deepEqual(
    normalizeSyncSettings({
      provider: "firebase",
      roomId: "room",
      firebaseConfigText: " {\"projectId\":\"demo\"} "
    }),
    {
      provider: "firebase",
      roomId: "room",
      firebaseConfigText: "{\"projectId\":\"demo\"}",
      supabaseUrl: "",
      supabaseAnonKey: ""
    }
  );
});
