from pathlib import Path
p = Path("src/lib/gmail.functions.ts")
t = p.read_text()
if "assistantGmailCap" in t:
    print("already")
else:
    old = '''    try {
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
    }'''
    new = '''    try {
      const team = await import("@/server/team.server");
      const email = (context.claims as { email?: string } | undefined)?.email;
      // Assistant: owner-set personal Gmail cap (cannot connect everything)
      const personal = await team.assistantGmailCap(context.userId, email, CONNECTOR_ID);
      if (personal && personal.used >= personal.limit) {
        return { locked: true as const, reason: "profile_limit" as const, limit: personal.limit };
      }
      if (personal) {
        limit = Math.min(limit, personal.limit);
        total = Math.max(total, personal.used);
      }
      const gate = await team.teamSharedProfileGate(
        context.userId,
        email,
        ent.profileLimit,
        CONNECTOR_ID,
      );
      if (gate.shared) {
        total = Math.max(total, gate.used);
        limit = Math.min(limit, gate.limit);
      }
    } catch (e) {
      console.error("team profile gate", e);
    }'''
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t)
        print("OK")
    else:
        print("WARN no anchor — insert after profile limit block manually needed")
