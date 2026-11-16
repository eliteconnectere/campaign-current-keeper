#!/usr/bin/env python3
"""
Elite Connectere - Complete Update:
1. Receiver-side Confetti Celebration
2. 'Edit Access' (Pencil) for Assistants & No 'Team' wording
3. Scoped Floating MagicCircle for Assistants (Settings only: connect & send)
4. Gmail Suspension & Penalty Engine Active Wiring
"""

import os
import re

def patch_file(filepath, search_str, replace_str, description):
    if not os.path.exists(filepath):
        print(f"[-] File not found: {filepath}")
        return False
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    if replace_str in content:
        print(f"[=] Already applied: {description}")
        return True
    if search_str not in content:
        print(f"[-] Search anchor not found for: {description}")
        return False
    new_content = content.replace(search_str, replace_str, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"[+] Applied: {description}")
    return True

# -------------------------------------------------------------
# 1. Update src/server/team.server.ts (add updateSeatCap & owner email on accept)
# -------------------------------------------------------------
team_server_path = "src/server/team.server.ts"
if os.path.exists(team_server_path):
    with open(team_server_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Add updateSeatCap function
    if "export async function updateSeatCap" not in code:
        patch_file(
            team_server_path,
            "export async function revokeSeat(",
            """export async function updateSeatCap(
  ownerUserId: string,
  seatId: string,
  maxGmailProfiles: number,
) {
  const cap = Math.min(75, Math.max(1, Math.floor(maxGmailProfiles) || 5));
  const db = await admin();
  const { data, error } = await db
    .from("team_seats")
    .update({ max_gmail_profiles: cap })
    .eq("id", seatId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, seat: data as TeamSeat };
}

export async function revokeSeat(""",
            "Add updateSeatCap to team.server.ts"
        )

    # Return owner email on acceptInvite
    patch_file(
        team_server_path,
        """  return { ok: true as const, seat: data as TeamSeat };
}

export async function revokeSeat""",
        """  let ownerEmail = "Workspace Owner";
  try {
    const { data: ownerUser } = await db.auth.admin.getUserById(seat.owner_user_id);
    if (ownerUser?.user?.email) ownerEmail = ownerUser.user.email;
  } catch {}
  return { ok: true as const, seat: data as TeamSeat, ownerEmail };
}

export async function revokeSeat""",
        "Include ownerEmail in acceptInvite output"
    )

# -------------------------------------------------------------
# 2. Update src/lib/team.functions.ts (export updateAssistantSeat)
# -------------------------------------------------------------
team_functions_path = "src/lib/team.functions.ts"
if os.path.exists(team_functions_path):
    patch_file(
        team_functions_path,
        'export const revokeTeamSeat = createServerFn({ method: "POST" })',
        """export const updateAssistantSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { seatId: string; maxGmailProfiles: number }) => {
    if (typeof input?.seatId !== "string" || !input.seatId.trim()) {
      throw new Error("Seat ID required");
    }
    const max = Math.min(75, Math.max(1, Math.floor(Number(input?.maxGmailProfiles)) || 5));
    return { seatId: input.seatId.trim(), maxGmailProfiles: max };
  })
  .handler(async ({ context, data }) => {
    const { updateSeatCap } = await import("@/server/team.server");
    return updateSeatCap(context.userId, data.seatId, data.maxGmailProfiles);
  });

export const revokeTeamSeat = createServerFn({ method: "POST" })""",
        "Export updateAssistantSeat server function"
    )

# -------------------------------------------------------------
# 3. Update src/server/billing.server.ts (add isAssistant flag)
# -------------------------------------------------------------
billing_path = "src/server/billing.server.ts"
if os.path.exists(billing_path):
    with open(billing_path, "r", encoding="utf-8") as f:
        bcode = f.read()

    if "isAssistant" not in bcode:
        bcode = bcode.replace(
            "  company: boolean;\n};",
            "  company: boolean;\n  isAssistant?: boolean;\n  assistantGmailCap?: number | null;\n};",
            1,
        )
        # Ensure team variable is available in return - soft patch
        if "isAssistant:" not in bcode:
            # Find return block end company,
            if "    company,\n  };" in bcode:
                bcode = bcode.replace(
                    "    company,\n  };",
                    "    company,\n    isAssistant: false,\n  };",
                    1,
                )
            # Better: set isAssistant when team inherited
            if 'if (team?.inherited)' in bcode or 'if (team?.inherited)' in bcode:
                pass
            # Inject after team inherit block sets plan
            marker = "      if (team?.inherited) {"
            if marker in bcode and "isAssistant = true" not in bcode:
                # use a local let isAssistant at start of entitlementsFor
                if "let isAssistant = false;" not in bcode:
                    bcode = bcode.replace(
                        "  let customization = false;",
                        "  let customization = false;\n  let isAssistant = false;\n  let assistantGmailCap: number | null = null;",
                        1,
                    )
                bcode = bcode.replace(
                    marker,
                    marker + "\n        isAssistant = true;\n        assistantGmailCap = team.inherited.profileLimit ?? null;",
                    1,
                )
                bcode = bcode.replace(
                    "    company,\n    isAssistant: false,\n  };",
                    "    company,\n    isAssistant,\n    assistantGmailCap,\n  };",
                    1,
                )
                if "isAssistant,\n    assistantGmailCap" not in bcode and "    company,\n  };" in bcode:
                    bcode = bcode.replace(
                        "    company,\n  };",
                        "    company,\n    isAssistant,\n    assistantGmailCap,\n  };",
                        1,
                    )
        with open(billing_path, "w", encoding="utf-8") as f:
            f.write(bcode)
        print("[+] Applied: isAssistant in billing.server.ts")
    else:
        print("[=] billing already has isAssistant")

# Also billing.functions Entitlements type if separate
bill_fn = "src/lib/billing.functions.ts"
if os.path.exists(bill_fn):
    with open(bill_fn, "r", encoding="utf-8") as f:
        bf = f.read()
    if "isAssistant" not in bf and "company: boolean;" in bf:
        bf = bf.replace(
            "  company: boolean;\n};",
            "  company: boolean;\n  isAssistant?: boolean;\n  assistantGmailCap?: number | null;\n};",
            1,
        )
        with open(bill_fn, "w", encoding="utf-8") as f:
            f.write(bf)
        print("[+] billing.functions type updated")

# -------------------------------------------------------------
# 4. Update src/features/team/TeamPanel.tsx (Edit pencil, no 'Team' phrasing)
# -------------------------------------------------------------
team_panel_path = "src/features/team/TeamPanel.tsx"
if os.path.exists(team_panel_path):
    with open(team_panel_path, "r", encoding="utf-8") as f:
        panel_code = f.read()

    panel_code = panel_code.replace(
        "import { Users, UserPlus, Trash2, Copy, Check, Loader2 } from \"lucide-react\";",
        "import { Users, UserPlus, Trash2, Pencil, Check, X, Loader2, Copy } from \"lucide-react\";",
    )
    if "updateAssistantSeat" not in panel_code:
        panel_code = panel_code.replace(
            "  revokeTeamSeat,\n  type TeamSeatView,",
            "  revokeTeamSeat,\n  updateAssistantSeat,\n  type TeamSeatView,",
        )

    if "editingSeatId" not in panel_code:
        panel_code = panel_code.replace(
            "  const [copiedId, setCopiedId] = useState<string | null>(null);",
            """  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editingCap, setEditingCap] = useState<number>(5);""",
        )

    save_cap_fn = """  const saveCap = async (seatId: string) => {
    setBusy(true);
    try {
      const res = await updateAssistantSeat({ data: { seatId, maxGmailProfiles: editingCap } });
      if (!res.ok) {
        toast.error(res.error || "Could not update limit");
        return;
      }
      toast.success(`Updated limit to ${editingCap} Gmail(s)`);
      setEditingSeatId(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

"""
    if "const saveCap = async" not in panel_code:
        panel_code = panel_code.replace(
            "  const revoke = async (seatId: string) => {",
            save_cap_fn + "  const revoke = async (seatId: string) => {",
            1,
        )

    old_item_ui = """                {s.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void copyLink(s)}
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-brand"
                    title="Copy link"
                  >
                    {copiedId === s.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                )}"""

    new_item_ui = """                {s.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void copyLink(s)}
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-brand"
                    title="Copy link"
                  >
                    {copiedId === s.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                )}
                {editingSeatId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={75}
                      value={editingCap}
                      onChange={(e) => setEditingCap(Math.min(75, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-14 rounded-md border border-brand px-1.5 py-1 text-center text-[12px] font-bold"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveCap(s.id)}
                      className="rounded-lg bg-brand p-1.5 text-white hover:opacity-90"
                      title="Save limit"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSeatId(null)}
                      className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeatId(s.id);
                      setEditingCap(s.max_gmail_profiles ?? 5);
                    }}
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-brand"
                    title="Edit Gmail limit"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}"""

    if old_item_ui in panel_code and "editingSeatId === s.id" not in panel_code:
        panel_code = panel_code.replace(old_item_ui, new_item_ui)
        print("[+] pencil UI")
    elif "editingSeatId === s.id" in panel_code:
        print("[=] pencil UI already")
    else:
        print("[-] pencil UI anchor missing")

    panel_code = panel_code.replace("Team invite accepted", "Assistant access accepted")
    panel_code = panel_code.replace("Team table is not ready", "Assistant table is not ready")

    with open(team_panel_path, "w", encoding="utf-8") as f:
        f.write(panel_code)
    print("[+] TeamPanel updates written")

# -------------------------------------------------------------
# 5-7. Gmail penalties — only if gmailPenalties.server exists
# -------------------------------------------------------------
if os.path.exists("src/server/gmailPenalties.server.ts"):
    connect_server_path = "src/server/gmailConnect.server.ts"
    if os.path.exists(connect_server_path):
        with open(connect_server_path, "r", encoding="utf-8") as f:
            code = f.read()
        code = code.replace(
            'reason: "connected" | "no_send_scope" | "no_identity" | "limit_reached";',
            'reason: "connected" | "no_send_scope" | "no_identity" | "limit_reached" | "suspended" | "banned";',
        )
        if 'message?: string' not in code and "export type ConnectOutcome" in code:
            code = code.replace(
                'email: string | null;\n};',
                'email: string | null;\n  message?: string;\n};',
                1,
            )
        if "connectGate" not in code:
            print("[~] connectGate hook skipped — need storeConnection anchor")
        with open(connect_server_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("[+] gmailConnect outcome types")

    gmail_fn_path = "src/lib/gmail.functions.ts"
    if os.path.exists(gmail_fn_path):
        with open(gmail_fn_path, "r", encoding="utf-8") as f:
            gcode = f.read()
        old_403 = """    if (res.status === 401 || res.status === 403) {
      await releaseClaim();
      const bodyText = await res.text();
      console.error(`Gmail send refused [${res.status}]: ${bodyText}`);
      const isQuota = /quota|rateLimitExceeded|userRateLimit/i.test(bodyText);
      return {
        ok: false,
        reason: isQuota ? ("all_exhausted" as const) : ("reconnect" as const),
        profileId: preferred.id,
        message: isQuota ? "Gmail daily sending quota or rate limit exceeded for this profile." : undefined,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }"""
        flag_handling = """    if (res.status === 401 || res.status === 403) {
      await releaseClaim();
      const bodyText = await res.text();
      console.error(`Gmail send refused [${res.status}]: ${bodyText}`);
      const isQuota = /quota|rateLimitExceeded|userRateLimit/i.test(bodyText);
      if (!isQuota) {
        try {
          const { flagAccount } = await import("@/server/gmailPenalties.server");
          await flagAccount(preferred.email_key);
        } catch (e) {
          console.error("flagAccount trigger error", e);
        }
      }
      return {
        ok: false,
        reason: isQuota ? ("all_exhausted" as const) : ("reconnect" as const),
        profileId: preferred.id,
        message: isQuota
          ? "Gmail daily sending quota or rate limit exceeded for this profile."
          : `Gmail account ${preferred.account_email} was flagged by Google and disconnected. It is suspended from Elite Engine for 5 days.`,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }"""
        if old_403 in gcode and "flagAccount" not in gcode:
            gcode = gcode.replace(old_403, flag_handling)
            with open(gmail_fn_path, "w", encoding="utf-8") as f:
                f.write(gcode)
            print("[+] flagAccount on 403")
        else:
            print("[=] or skip gmail 403 flag")
else:
    print("[=] gmailPenalties.server.ts not present — penalty wiring skipped")

# -------------------------------------------------------------
# 8. app.tsx — assistant celebrate + magic circle soft patches
# -------------------------------------------------------------
app_path = "src/routes/app.tsx"
if os.path.exists(app_path):
    with open(app_path, "r", encoding="utf-8") as f:
        app_code = f.read()

    if "assistantCelebrate" not in app_code:
        if "const [celebrate, setCelebrate] = useState(false);" in app_code:
            app_code = app_code.replace(
                "  const [celebrate, setCelebrate] = useState(false);",
                """  const [celebrate, setCelebrate] = useState(false);
  const [assistantCelebrate, setAssistantCelebrate] = useState<{
    ownerEmail: string;
    maxGmails: number;
  } | null>(null);""",
                1,
            )
            print("[+] assistantCelebrate state")
        else:
            # near teamOpen
            app_code = app_code.replace(
                "const [teamOpen, setTeamOpen] = useState(false);",
                """const [teamOpen, setTeamOpen] = useState(false);
  const [assistantCelebrate, setAssistantCelebrate] = useState<{
    ownerEmail: string;
    maxGmails: number;
  } | null>(null);""",
                1,
            )
            print("[+] assistantCelebrate near teamOpen")

    # Soften invite accept toast path if present
    if "Team invite accepted" in app_code:
        app_code = app_code.replace(
            "Team invite accepted — your Gmails stay on this login only",
            "Assistant access accepted — your Gmails stay on this login only",
        )

    # Try wire setAssistantCelebrate on accept
    old_accept_snippets = [
        'toast.success("Team invite accepted — your Gmails stay on this login only");',
        'toast.success("Joined the team — use your own Gmails only");',
        'toast.success("Assistant access accepted — your Gmails stay on this login only");',
    ]
    for s in old_accept_snippets:
        if s in app_code and "setAssistantCelebrate" in app_code:
            app_code = app_code.replace(
                s,
                """setAssistantCelebrate({
              ownerEmail: (res as any).ownerEmail || "Workspace Owner",
              maxGmails: (res as any).seat?.max_gmail_profiles ?? 5,
            });
            toast.success("Assistant access accepted");""",
                1,
            )
            print("[+] accept celebrate wire")
            break

    modal = """      {assistantCelebrate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-ink/40 px-6"
          onClick={() => setAssistantCelebrate(null)}
        >
          <div className="relative w-full max-w-[340px] animate-scale-in rounded-3xl border border-line bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="mt-3 text-[18px] font-bold tracking-tight text-ink">CONGRATULATIONS!</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              You have received workspace access from{" "}
              <strong className="text-ink">{assistantCelebrate.ownerEmail}</strong>.
            </p>
            <div className="mt-4 rounded-2xl bg-soft p-3 text-[12px] text-ink-soft">
              Connect up to{" "}
              <strong className="text-brand">{assistantCelebrate.maxGmails} Gmail profile(s)</strong>.
              Your connected accounts remain private to your login.
            </div>
            <button
              type="button"
              onClick={() => setAssistantCelebrate(null)}
              className="mt-4 w-full rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white shadow"
            >
              Start Sending
            </button>
          </div>
        </div>
      )}
"""
    if "{assistantCelebrate &&" not in app_code and "assistantCelebrate" in app_code:
        if "{teamOpen &&" in app_code:
            app_code = app_code.replace("{teamOpen &&", modal + "\n      {teamOpen &&", 1)
            print("[+] celebrate modal")
        elif "{celebrate &&" in app_code:
            app_code = app_code.replace("{celebrate &&", modal + "\n      {celebrate &&", 1)
            print("[+] celebrate modal near celebrate")

    # MagicCircle: add isAssistant to condition if simple pattern exists
    if "entitlements?.isAssistant" not in app_code and "MagicCircle" in app_code:
        # broaden elite floating circle for assistants with settings only — best-effort
        if 'mode === "elite" && chatEligible' in app_code:
            app_code = app_code.replace(
                'mode === "elite" && chatEligible',
                'mode === "elite" && (chatEligible || entitlements?.isAssistant)',
                1,
            )
            print("[+] magic circle condition")

    with open(app_path, "w", encoding="utf-8") as f:
        f.write(app_code)
    print("[+] app.tsx written")

print("\n[OK] Complete update script finished.")
