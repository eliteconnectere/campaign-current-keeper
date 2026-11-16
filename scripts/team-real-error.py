from pathlib import Path
p = Path("src/server/team.server.ts")
t = p.read_text()
# Soften false "table not ready" — always surface real message first
old = '''    return {
      ok: false as const,
      error:
        error.message.includes("team_seats") || error.code === "42P01"
          ? "Team table is not ready. Run team_seats SQL in Supabase."
          : error.message,
    };'''
# There may be two similar blocks
new = '''    const missing =
      error.code === "42P01" ||
      /relation .*team_seats.* does not exist/i.test(error.message);
    return {
      ok: false as const,
      error: missing
        ? "Team table is not ready. Run team_seats SQL in Supabase."
        : `Could not add: ${error.message}${error.code ? ` (${error.code})` : ""}`,
    };'''
count = t.count("Team table is not ready")
print("occurrences", count)
t2 = t.replace(
    '''        error.message.includes("team_seats") || error.code === "42P01"
          ? "Team table is not ready. Run team_seats SQL in Supabase."
          : error.message,''',
    '''        error.code === "42P01" || /relation .*team_seats.* does not exist/i.test(error.message)
          ? "Team table is not ready. Run team_seats SQL in Supabase."
          : `Could not add: ${error.message}${error.code ? ` (${error.code})` : ""}`,''',
)
if t2 != t:
    p.write_text(t2)
    print("updated", t2.count("Could not add"))
else:
    print("no replace")
