#!/usr/bin/env python3
from pathlib import Path

# Apply the main assistant-first script if present
import runpy
p = Path("scripts/fix_rex_assistant_first_draft_send.py")
if p.exists():
    try:
        runpy.run_path(str(p))
    except Exception as e:
        print("v1 error", e)

app = Path("src/routes/app.tsx")
a = app.read_text()

# Flag when starting send
if 'localStorage.setItem("ec-engine-resume"' not in a:
    a = a.replace(
        'setEngine("sending");\n    setScout(true);\n    log("Campaign started — Elite Engine is now sending.", "campaignStarted");',
        'setEngine("sending");\n    try { localStorage.setItem("ec-engine-resume", "1"); } catch {}\n    setScout(true);\n    log("Campaign started — Elite Engine is now sending.", "campaignStarted");',
        1,
    )
    print("resume flag on start")

# Clear on stop / idle complete - patch finishCampaignRun or stopCampaign
if 'localStorage.removeItem("ec-engine-resume")' not in a:
    a = a.replace(
        'function stopCampaign(): boolean {\n    if (engine !== "sending" && engine !== "paused") return false;\n    setEngine("idle");',
        'function stopCampaign(): boolean {\n    if (engine !== "sending" && engine !== "paused") return false;\n    try { localStorage.removeItem("ec-engine-resume"); } catch {}\n    setEngine("idle");',
        1,
    )
    a = a.replace(
        'function pauseCampaign(): boolean {\n    if (engine !== "sending") return false;\n    setEngine("paused");',
        'function pauseCampaign(): boolean {\n    if (engine !== "sending") return false;\n    try { localStorage.removeItem("ec-engine-resume"); } catch {}\n    setEngine("paused");',
        1,
    )
    print("clear on stop/pause")

# On connection-drop pause, KEEP resume flag (user did not stop)
# Already keeps flag if we only clear on intentional pause/stop

# Auto-resume when app visible / online and flag set
marker = "EC_AUTO_RESUME_ENGINE"
if marker not in a and "function startCampaign(" in a:
    hook = '''
  // ''' + marker + ''': continue campaign after minimize/logout/reconnect if user never stopped it.
  useEffect(() => {
    const tryResume = () => {
      try {
        if (localStorage.getItem("ec-engine-resume") !== "1") return;
        if (engine === "sending") return;
        // startCampaign is stable enough when engine is idle/paused after a drop
        void Promise.resolve(startCampaign()).catch(() => {});
      } catch {}
    };
    const onVis = () => { if (document.visibilityState === "visible") tryResume(); };
    const onOnline = () => tryResume();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    // short delay after mount so workspace state is hydrated
    const t = window.setTimeout(tryResume, 1200);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [engine, signedIn]);
'''
    # inject after pauseCampaign block end
    needle = "function stopCampaign(): boolean {"
    pos = a.find(needle)
    if pos > 0:
        # find closing of stopCampaign - next function
        end = a.find("\n  function ", pos + 10)
        if end < 0:
            end = a.find("\n  const ", pos + 10)
        if end > 0:
            a = a[:end] + "\n" + hook + a[end:]
            print("resume effect injected")

app.write_text(a)
print("app size", app.stat().st_size)
print("done v2")
