from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text()

# ---- 1. nextInSec state near delay state ----
if "nextInSec" not in t:
    t = t.replace(
        "const [delay, setDelay] = useState(5);",
        "const [delay, setDelay] = useState(5);\n  const [nextInSec, setNextInSec] = useState<number | null>(null);",
        1,
    )
    print("nextInSec state")

# ---- 2. Fix startedAt: measure from send START, not after API ----
# Before await sendGmailMessage, capture sendStart
if "const sendStart = performance.now()" not in t:
    old = """      let result: Awaited<ReturnType<typeof sendGmailMessage>>;
      try {
        result = await sendGmailMessage({
"""
    new = """      // Wall-clock pace: delay is measured from THIS send's start so Gmail RTT
      // counts toward the selected seconds (3s feels ~3s, not 3s + API).
      const sendStart = performance.now();
      let result: Awaited<ReturnType<typeof sendGmailMessage>>;
      try {
        result = await sendGmailMessage({
"""
    if old in t:
        t = t.replace(old, new, 1)
        print("sendStart")
    else:
        print("WARN sendStart anchor")

# After successful send, use sendStart not performance.now()
# Replace the success path startedAt reset
t2 = t.replace(
    """        if (result.rotated) {
          setActiveProfileId(result.profileId);
          activeRef.current = result.profileId;
          log(`Rotated to ${result.email} — the previous profile reached its limit. Sent total continues.`);
        }
        startedAt = performance.now();
        waitThen();
        return;
      }""",
    """        if (result.rotated) {
          setActiveProfileId(result.profileId);
          activeRef.current = result.profileId;
          log(`Rotated to ${result.email} — the previous profile reached its limit. Sent total continues.`);
        }
        // Keep cycle clock from sendStart so remaining wait = delay - API time
        startedAt = sendStart;
        waitThen();
        return;
      }""",
    1,
)
if t2 != t:
    t = t2
    print("success startedAt = sendStart")
else:
    # softer: only replace first "startedAt = performance.now();\n        waitThen();" after ok
    t = t.replace(
        "startedAt = performance.now();\n        waitThen();\n        return;\n      }\n\n      if (result.reason === \"already_sent\")",
        "startedAt = sendStart;\n        waitThen();\n        return;\n      }\n\n      if (result.reason === \"already_sent\")",
        1,
    )
    print("soft success path")

# already_sent can keep performance.now() or sendStart - use now for skip is fine

# ---- 3. waitThen updates nextInSec for UI ----
old_wait = """    const waitThen = () => {
      if (cancelled) return;
      const tick = () => {
        if (cancelled) return;
        const due = startedAt + delayRef.current * 1000 - performance.now();
        if (due <= 0) void step();
        else timer = window.setTimeout(tick, Math.min(due, 100));
      };
      tick();
    };"""
new_wait = """    const waitThen = () => {
      if (cancelled) return;
      const tick = () => {
        if (cancelled) return;
        const due = startedAt + delayRef.current * 1000 - performance.now();
        if (due <= 0) {
          setNextInSec(0);
          void step();
        } else {
          setNextInSec(Math.max(0, Math.ceil(due / 1000)));
          timer = window.setTimeout(tick, Math.min(due, 100));
        }
      };
      tick();
    };"""
if old_wait in t:
    t = t.replace(old_wait, new_wait, 1)
    print("waitThen UI")
else:
    print("WARN waitThen")

# Clear nextInSec on stop - find setEngine("idle") patterns in stop function
if "setNextInSec(null)" not in t:
    # inject into stop helper if exists
    if "const stop = (msg?: string)" in t or "const stop = (msg:" in t:
        t = t.replace(
            "setEngine(\"idle\");",
            "setEngine(\"idle\");\n      setNextInSec(null);",
            1,
        )
        print("stop clears nextInSec")

# ---- 4. UI: Next in Xs near SENDING badge ----
old_badge = '''                    {engine === "sending" ? "SENDING" : engine === "paused" ? "PAUSED" : "IDLE"}'''
new_badge = '''                    {engine === "sending"
                      ? nextInSec != null && nextInSec > 0
                        ? `SENDING · Next in ${nextInSec}s`
                        : "SENDING"
                      : engine === "paused"
                        ? "PAUSED"
                        : "IDLE"}'''
if old_badge in t:
    t = t.replace(old_badge, new_badge, 1)
    print("badge")
else:
    print("WARN badge")

# ---- 5. File import for recipients list ----
if "importListFile" not in t and "data-tour=\"recipients\"" in t:
    # add handler near validate function if possible
    handler = '''
  const importListFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
      toast.success(`Loaded ${file.name} — review then Validate`);
    };
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsText(file);
  };
'''
    if "async function validate" in t:
        t = t.replace("async function validate", handler + "  async function validate", 1)
        print("importListFile handler")
    elif "function validate" in t:
        t = t.replace("function validate", handler + "  function validate", 1)
        print("importListFile handler2")

    # UI chip near recipients - find Smart Fill button area
    if 'data-tour="recipients"' in t and "Import list file" not in t:
        # add a small label after recipients card title patterns
        tip = '''
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink">
                Import .txt / .csv
                <input
                  type="file"
                  accept=".txt,.csv,.tsv,text/plain,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    importListFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>'''
        # Try insert before Smart Fill if present
        if "Smart Fill" in t:
            # find first Smart Fill button - insert import before it in same toolbar
            m = re.search(r".{0,80}Smart Fill", t)
            if m:
                # insert after a flex gap container open near recipients - safer: after data-tour recipients section first flex
                pass
        # Append near placeholder text for recipients
        if "Paste emails" in t or "paste" in t.lower():
            # add under first textarea for raw if we can find setRaw
            if "setRaw(" in t and "Import .txt" not in t:
                # find raw textarea closing and add after
                ta = re.search(r"(value=\{raw\}[\s\S]{0,400}?</textarea>)", t)
                if ta:
                    t = t[: ta.end()] + tip + t[ta.end() :]
                    print("file import UI after textarea")
                else:
                    print("WARN textarea")
        else:
            print("WARN paste label")

p.write_text(t)
print("done", len(t))
