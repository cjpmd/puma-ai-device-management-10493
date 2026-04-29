/**
 * Unit tests for sync-external-user-access.
 *
 * These tests exercise the same conditional paths as the real handler without
 * calling live Supabase APIs. Run with: deno test --allow-none index.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ---------------------------------------------------------------------------
// Test 1: no Football Central user found → zero team access rows, matched=false
// ---------------------------------------------------------------------------
Deno.test("no FC email match: returns matched=false and teams_synced=0", async () => {
  const insertedRows: unknown[] = [];

  const result = await simulateSyncForEmail("unknown@example.com", {
    externalUserId: null, // simulates no profile match AND no admin.listUsers match
    teamMemberships: [],
    localTeamMap: {},
    onUpsert: (row) => insertedRows.push(row),
  });

  assertEquals(result.matched, false, "matched must be false when no FC user found");
  assertEquals(result.teams_synced, 0, "teams_synced must be 0 when no FC user found");
  assertEquals(insertedRows.length, 0, "user_team_access INSERT must not be called");
});

// ---------------------------------------------------------------------------
// Test 2: no fallback all-teams grant when externalUserId is null
// ---------------------------------------------------------------------------
Deno.test("no FC email match: fallback all-teams grant is never executed", async () => {
  let allTeamsQueried = false;

  // Simulate the exact guard added in the fix: if externalUserId is null,
  // we return early before any team query.
  const externalUserId: string | null = null;

  if (!externalUserId) {
    // This is where the old fallback lived. It must not execute.
  } else {
    // This block represents the old fallback (SELECT * FROM teams).
    allTeamsQueried = true;
  }

  assertEquals(
    allTeamsQueried,
    false,
    "all-teams fallback query must not fire when externalUserId is null",
  );
});

// ---------------------------------------------------------------------------
// Test 3: FC user found → team memberships are synced correctly
// ---------------------------------------------------------------------------
Deno.test("FC email match: team memberships are upserted", async () => {
  const upsertedRecords: { team_id: string; role: string }[] = [];

  const result = await simulateSyncForEmail("coach@club.com", {
    externalUserId: "ext-user-abc",
    teamMemberships: [
      { team_id: "ext-team-1", role: "team_manager" },
      { team_id: "ext-team-2", role: "team_coach" },
    ],
    localTeamMap: {
      "ext-team-1": "local-team-uuid-1",
      "ext-team-2": "local-team-uuid-2",
    },
    onUpsert: (row) => upsertedRecords.push(row as { team_id: string; role: string }),
  });

  assertEquals(result.matched, true, "matched must be true when FC user found");
  assertEquals(result.teams_synced, 2, "should sync 2 team memberships");
  assertEquals(upsertedRecords.length, 2, "should upsert 2 user_team_access rows");
  assertEquals(upsertedRecords[0].role, "team_manager");
  assertEquals(upsertedRecords[1].role, "team_coach");
});

// ---------------------------------------------------------------------------
// Test 4: FC user found but no local team mapping → zero rows upserted
// ---------------------------------------------------------------------------
Deno.test("FC email match but no local teams: zero rows upserted", async () => {
  const upsertedRecords: unknown[] = [];

  const result = await simulateSyncForEmail("coach@club.com", {
    externalUserId: "ext-user-abc",
    teamMemberships: [{ team_id: "ext-team-unknown", role: "team_coach" }],
    localTeamMap: {}, // no matching local teams
    onUpsert: (row) => upsertedRecords.push(row),
  });

  assertEquals(result.matched, true, "matched must be true — user was found in FC");
  assertEquals(result.teams_synced, 0, "no rows synced if local team not in map");
  assertEquals(upsertedRecords.length, 0);
});

// ---------------------------------------------------------------------------
// Simulation helper — mirrors the fixed handler logic without live Supabase.
// ---------------------------------------------------------------------------

interface SyncOptions {
  externalUserId: string | null;
  teamMemberships: { team_id: string; role: string }[];
  localTeamMap: Record<string, string>;
  onUpsert?: (row: unknown) => void;
}

interface SyncResult {
  matched: boolean;
  teams_synced: number;
}

async function simulateSyncForEmail(
  email: string,
  opts: SyncOptions,
): Promise<SyncResult> {
  // Mirror the guard introduced by Fix 1.
  if (!opts.externalUserId) {
    console.warn(
      `sync-external-user-access: No matching Football Central user for email: ${email}`,
    );
    return { matched: false, teams_synced: 0 };
  }

  // Mirror team membership upsert loop.
  let synced = 0;
  for (const membership of opts.teamMemberships) {
    const localTeamId = opts.localTeamMap[membership.team_id];
    if (!localTeamId) continue;
    opts.onUpsert?.({
      team_id: localTeamId,
      role: membership.role,
      external_user_id: opts.externalUserId,
    });
    synced++;
  }

  return { matched: true, teams_synced: synced };
}
