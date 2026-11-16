from pathlib import Path

p = Path("src/lib/gmail.functions.ts")
t = p.read_text()

old = '''    const total = (await listProfileRows(context.userId, CONNECTOR_ID)).length;
    if (total >= ent.profileLimit) {
      return { locked: true as const, reason: "profile_limit" as const, limit: ent.profileLimit };
    }'''

new = '''    // Team shares ONE profile pool (owner + members). Not 75 each.
    let total = (await listProfileRows(context.userId, CONNECTOR_ID)).length;
    let limit = ent.profileLimit;
    try {
      const team = await import("@/server/team.server");
      const gate = await team.teamSharedProfileGate(
        context.userId,
        (context.claims as { email?: string } | undefined)?.email,
        ent.profileLimit,
        CONNECTOR_ID,
      );
      if (gate.shared) {
        total = gate.used;
        limit = gate.limit;
      }
    } catch (e) {
      console.error("team profile gate", e);
    }
    if (total >= limit) {
      return { locked: true as const, reason: "profile_limit" as const, limit };
    }'''

if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("OK shared profile gate")
else:
    print("WARN anchor not found")
    if "teamSharedProfileGate" in t:
        print("already patched")
