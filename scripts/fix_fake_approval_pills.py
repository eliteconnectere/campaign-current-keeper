#!/usr/bin/env python3
"""
Gemini invents [[APPROVE & INSPECT WORKSPACE]] as plain text.
Real pills use [[REX_*_APPROVAL:...]]. Strip fakes and inject the real marker when needed.
"""
from pathlib import Path

BRIEF = '''
APPROVAL CONTROLS (CRITICAL):
- Never invent approval buttons, pills, or markers in your prose.
- Never write text like [[APPROVE & INSPECT WORKSPACE]], [Approve], or "tap the approval button below" unless a real registered marker is present from a tool result.
- Registered markers only (examples): [[REX_ACTIVE_WORKSPACE_READ_APPROVAL:...]], [[REX_WORKSPACE_READ_APPROVAL:...]], [[REX_APPROVAL:id:action]], [[REX_LOGOUT_APPROVAL]], [[REX_VALIDATE_APPROVAL]], [[REX_IMPORT_APPROVAL]].
- To inspect the user's live draft (subject, body, recipients), call the proper workspace-read tool so the client can render the real red approval control. Do not simulate approval in Markdown.
- If a tool is unavailable, say honestly that the approval control could not be prepared — do not fake a button.
'''


def patch_assist_brief() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if "Never invent approval buttons" not in t:
        anchors = [
            "Navigation is free reasoning, not a keyword router.",
            "SAFE navigation is automatic",
            "You are Rex",
        ]
        for a in anchors:
            if a in t:
                t = t.replace(a, a + "\n\n" + BRIEF, 1)
                print("brief approval rules added via", a[:40])
                break
        else:
            # append near end of SYSTEM style string is hard; force insert after first long system section
            print("WARN: no anchor for brief")
    path.write_text(t)


def patch_elite_assist() -> None:
    path = Path("src/features/assist/EliteAssist.tsx")
    t = path.read_text()

    helper = '''
  /** Gemini sometimes invents fake [[APPROVE ...]] text. Only registered REX_* markers render as pills. */
  function sanitizeAssistantApprovals(content: string, userQuestion: string): string {
    let out = content
      .replace(/\[\[\s*APPROVE[^\]]*\]\]/gi, "")
      .replace(/\[\s*APPROVE[^\]]*\]/gi, "")
      .replace(/tap the approval button below\.?/gi, "")
      .replace(/just tap the approval button below\.?/gi, "");
    const wantsInspect = /\b(read|inspect|check|see|look at|show)\b[\s\S]{0,80}\b(message|subject|body|draft|workspace|campaign content|what i (wrote|prepared)|current message)\b/i.test(userQuestion)
      || /\b(my current message|message (i want to|to) (send|execute)|campaign (message|content|draft))\b/i.test(userQuestion);
    const hasReal = /\[\[REX_(ACTIVE_WORKSPACE_READ|WORKSPACE_READ|APPROVAL|VALIDATE|IMPORT|LOGOUT|TEMPLATE|SETTING|PLANNER|SMART_FILL|MEMORY|CHAT)/i.test(out);
    if (wantsInspect && !hasReal && onReadActiveWorkspace) {
      const areas = ["subject", "body", "recipients", "status", "templates"];
      const marker = "[[REX_ACTIVE_WORKSPACE_READ_APPROVAL:" + encodeURIComponent(JSON.stringify({ areas })) + "]];
      out = out.trimEnd() + "\n\n" + marker;
    }
    return out;
  }
'''

    if "sanitizeAssistantApprovals" not in t:
        # insert after pendingImport state
        marker = "  const [pendingImport, setPendingImport]"
        idx = t.find(marker)
        if idx < 0:
            raise SystemExit("pendingImport not found")
        # find end of that line's block - insert after historyReady effects area before runRexCampaignCommand
        insert_at = t.find("  async function runRexCampaignCommand")
        if insert_at < 0:
            insert_at = t.find("  async function persistMessage")
        if insert_at < 0:
            raise SystemExit("insert point missing")
        t = t[:insert_at] + helper + "\n" + t[insert_at:]
        print("helper inserted")

        # wrap places where assistant content is set from AI reply
        # common pattern: setMsgs(... content: reply) after askEliteAssist
        # Find askEliteAssist result assignment
        patterns = [
            ("content: result.reply", "content: sanitizeAssistantApprovals(result.reply, question)"),
            ("content: result.message", "content: sanitizeAssistantApprovals(result.message, question)"),
            ("content: answer", "content: sanitizeAssistantApprovals(answer, question)"),
        ]
        # also broader: after getting reply string variable
        if "sanitizeAssistantApprovals(result" not in t:
            # find typical block
            for old, new in [
                ('const reply = result.reply', 'const reply = sanitizeAssistantApprovals(String(result.reply ?? ""), question)'),
                ('const reply = result.message', 'const reply = sanitizeAssistantApprovals(String(result.message ?? ""), question)'),
                ('content: data.reply', 'content: sanitizeAssistantApprovals(String(data.reply ?? ""), question)'),
            ]:
                if old in t and "sanitizeAssistantApprovals" not in t[t.find(old)-50:t.find(old)+80]:
                    t = t.replace(old, new, 1)
                    print("wrapped", old)

        # fallback: wrap any setMsgs assistant content from reply variable near askEliteAssist
        if t.count("sanitizeAssistantApprovals(") < 2:
            # search for askEliteAssist(
            pos = 0
            while True:
                i = t.find("askEliteAssist", pos)
                if i < 0:
                    break
                # look ahead 800 chars for setMsgs with role assistant
                window = t[i:i+2500]
                if "sanitizeAssistantApprovals" not in window and "role: \"assistant\"" in window:
                    # replace first content: something in that window carefully
                    import re
                    m = re.search(r'content:\s*([a-zA-Z_][\w.]*)', window)
                    if m and m.group(1) not in ("message", "content"):
                        var = m.group(1)
                        t = t[:i] + window.replace(
                            f"content: {var}",
                            f"content: sanitizeAssistantApprovals(String({var} ?? \"\"), question)",
                            1,
                        ) + t[i+2500:]
                        print("wrapped askEliteAssist content var", var)
                        break
                pos = i + 12

    # Also strip fake approve markers in display path so they never show as text
    if ".replace(/\\[\\[\\s*APPROVE" not in t and "APPROVE[^\\]]*\\]\\]" not in t:
        # in the clean content pipeline near GO/SUGGEST replace
        needle = '.replace(/\\[\\[(SHOW|GO|SUGGEST'
        if needle in t:
            t = t.replace(
                needle,
                '.replace(/\\[\\[\\s*APPROVE[^\\]]*\\]\\]/gi, "")\n    .replace(/\\[\\[(SHOW|GO|SUGGEST',
                1,
            )
            print("display strip fake APPROVE")

    path.write_text(t)
    print("EliteAssist", path.stat().st_size)


if __name__ == "__main__":
    patch_assist_brief()
    patch_elite_assist()
    print("done")
