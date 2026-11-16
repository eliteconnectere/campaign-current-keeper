#!/usr/bin/env python3
"""Register every Rex Studio + Feature Studio + AppSettings key for direct update_workspace_setting."""
from pathlib import Path
import re

REX_KEYS = [
    "rex.displayName",
    "rex.personality",
    "rex.autonomousMode",
    "rex.campaignMonitoring",
    "rex.allowCampaignExecution",
    "rex.allowCampaignScheduling",
    "rex.preSendReview",
    "rex.warnOnRisk",
    "rex.monitorDelivery",
    "rex.notifyHighRisk",
    "rex.notifyCampaignIssues",
    "rex.notifyRecommendations",
    "rex.memory.saveHistory",
    "rex.memory.rememberContext",
]

# Aliases the model might use (mapped in handler)
ALIASES = {
    "displayName": "rex.displayName",
    "rexName": "rex.displayName",
    "name": "rex.displayName",
    "agentName": "rex.displayName",
    "personality": "rex.personality",
    "rex.personality": "rex.personality",
    "autonomousMode": "rex.autonomousMode",
    "automation": "rex.autonomousMode",
}

# ---------- assist.functions.ts: expand enum + brief ----------
af = Path("src/lib/assist.functions.ts")
s = af.read_text()

old_enum = 'setting_key: { type: "STRING", enum: ["activityRecording"'
if '"rex.displayName"' not in s:
    # find the enum array and inject rex keys after nightModeCustomColor block end before notifications
    m = re.search(r'setting_key: \{ type: "STRING", enum: \[([^\]]+)\] \}', s)
    if m:
        items = [x.strip().strip('"') for x in m.group(1).split(",")]
        for k in REX_KEYS:
            if k not in items:
                items.append(k)
        # also allow common aliases the model may emit
        for k in ["displayName", "rexName", "agentName", "personality", "autonomousMode", "automation"]:
            if k not in items:
                items.append(k)
        new_enum = "setting_key: { type: \"STRING\", enum: [" + ",".join('"' + i + '"' for i in items) + "] }"
        s = s[: m.start()] + new_enum + s[m.end() :]
        print("enum expanded", len(items))
    else:
        print("WARN enum not found")
else:
    print("enum already has rex.displayName")

if "REX STUDIO SETTINGS REGISTRY" not in s:
    registry = '''
REX STUDIO SETTINGS REGISTRY (direct update_workspace_setting — no approval)
- rex.displayName (or displayName / name): agent display name, max 24 chars. Example: change your name to Atlas → setting_key rex.displayName value Atlas
- rex.personality: balanced | professional | friendly | direct
- rex.autonomousMode (automation): true/false
- rex.campaignMonitoring, rex.allowCampaignExecution, rex.allowCampaignScheduling: true/false
- rex.preSendReview, rex.warnOnRisk, rex.monitorDelivery: true/false
- rex.notifyHighRisk, rex.notifyCampaignIssues, rex.notifyRecommendations: true/false
- rex.memory.saveHistory, rex.memory.rememberContext: true/false
Never say a setting is "not in the approved registry" if it is listed above. Apply it with update_workspace_setting.
SMART FILL STUDIO: smartFill, smartFillMemory toggles
NIGHT MODE STUDIO: nightModeLight, nightModeColor, nightModeAnimation, nightModeSpeed, nightModeIntensity, nightModeCustomColor
INTERFACE STUDIO: uiDensity, textDensity, radius, shadow, font, weight, shapeMode (colours still via Studio UI wheel if hex HSL not provided)
SENDING STUDIO: sendingMode, campaign.delay, sounds, sendingSound, sendingSoundVariant, vibration, notificationSound, alarmRingtone
TRACKER/PLANNER/ACTIVITY: tracker, planner, activityRecording, showCampaignTimer
CHAT: chatSounds, chatEnterToSend, chatLinkPreview
NOTIFICATIONS: notifications.* keys already in the tool enum
'''
    s = s.replace("ASSISTANT FIRST, AGENT SECOND", registry + "\nASSISTANT FIRST, AGENT SECOND", 1)
    # Fix the outdated "only allowlist" sentence
    s = s.replace(
        "Current settings-write tool supports only its explicit allowlist of Studio, appearance, notification, sound, density, shape, sending-mode and related preferences. If the requested control is not in that allowlist, identify the exact missing setting rather than pretending it changed.",
        "Settings-write covers App Settings, Feature Studios, and Rex Studio keys in the tool enum (including rex.displayName). If a key is missing from the enum, say so once and open the matching studio; do not invent success.",
        1,
    )
    print("brief registry")

af.write_text(s)

# ---------- app.tsx: handle rex.* in onUpdateWorkspaceSetting ----------
app = Path("src/routes/app.tsx")
a = app.read_text()

# imports
if "saveRexConfig" not in a:
    # add import near other lib imports
    if 'from "@/lib/campaign.functions"' in a:
        a = a.replace(
            'from "@/lib/campaign.functions";',
            'from "@/lib/campaign.functions";\nimport { getRexConfig, saveRexConfig } from "@/lib/rex.functions";\nimport { getRexMemorySettings, saveRexMemorySettings } from "@/lib/rex-conversation.functions";',
            1,
        )
        print("imports")
    elif 'from "@/lib/gmail.functions"' in a:
        a = a.replace(
            'from "@/lib/gmail.functions";',
            'from "@/lib/gmail.functions";\nimport { getRexConfig, saveRexConfig } from "@/lib/rex.functions";\nimport { getRexMemorySettings, saveRexMemorySettings } from "@/lib/rex-conversation.functions";',
            1,
        )
        print("imports gmail")

# Change onUpdateWorkspaceSetting signature usage: currently returns boolean synchronously.
# For async rex save we need async path. Check signature.
if "onUpdateWorkspaceSetting?:" in Path("src/features/assist/EliteAssist.tsx").read_text():
    ea = Path("src/features/assist/EliteAssist.tsx").read_text()
    # Expand type to allow Promise<boolean>
    ea2 = ea.replace(
        "onUpdateWorkspaceSetting?: (settingKey: string, settingValue: string) => boolean",
        "onUpdateWorkspaceSetting?: (settingKey: string, settingValue: string) => boolean | Promise<boolean>",
    )
    if ea2 != ea:
        Path("src/features/assist/EliteAssist.tsx").write_text(ea2)
        print("EliteAssist async type")
    # Where result is used, await it
    if "onUpdateWorkspaceSetting(" in ea2:
        # find patterns that assign without await
        ea3 = re.sub(
            r"const ok = onUpdateWorkspaceSetting\(",
            "const ok = await onUpdateWorkspaceSetting(",
            ea2,
        )
        # also Boolean(onUpdateWorkspaceSetting(
        ea3 = re.sub(
            r"Boolean\(onUpdateWorkspaceSetting && onUpdateWorkspaceSetting\(",
            "Boolean(onUpdateWorkspaceSetting) && await onUpdateWorkspaceSetting(",
            ea3,
        )
        if ea3 != ea2:
            Path("src/features/assist/EliteAssist.tsx").write_text(ea3)
            print("await updates")

# Inject rex handler at start of onUpdateWorkspaceSetting body
if 'settingKey.startsWith("rex.")' not in a and "rex.displayName" not in a[a.find("onUpdateWorkspaceSetting"):a.find("onUpdateWorkspaceSetting")+3000]:
    # Find the callback start after onUpdateWorkspaceSetting={
    marker = "onUpdateWorkspaceSetting={(settingKey, settingValue) => {"
    if marker not in a:
        marker = "onUpdateWorkspaceSetting={(settingKey, settingValue) =>"
    if marker in a:
        insert = '''onUpdateWorkspaceSetting={async (settingKey, settingValue) => {
            // Normalize aliases → canonical keys
            const aliasMap: Record<string, string> = {
              displayName: "rex.displayName", name: "rex.displayName", rexName: "rex.displayName", agentName: "rex.displayName",
              personality: "rex.personality", autonomousMode: "rex.autonomousMode", automation: "rex.autonomousMode",
            };
            if (aliasMap[settingKey]) settingKey = aliasMap[settingKey];

            // Rex Studio config (server-persisted)
            if (settingKey.startsWith("rex.memory.")) {
              try {
                const field = settingKey.slice("rex.memory.".length);
                const { settings: cur } = await getRexMemorySettings();
                const next = { ...cur } as { saveHistory: boolean; rememberContext: boolean };
                if (field === "saveHistory" || field === "rememberContext") {
                  if (!["true", "false"].includes(String(settingValue).toLowerCase())) return false;
                  next[field] = String(settingValue).toLowerCase() === "true";
                  await saveRexMemorySettings({ data: next });
                  return true;
                }
                return false;
              } catch { return false; }
            }
            if (settingKey.startsWith("rex.")) {
              try {
                const field = settingKey.slice(4);
                const { config: cur } = await getRexConfig();
                const next = { ...cur } as Record<string, unknown>;
                if (field === "displayName") {
                  const name = String(settingValue).trim().replace(/[<>]/g, "").slice(0, 24);
                  if (!name) return false;
                  next.displayName = name;
                } else if (field === "personality") {
                  if (!["balanced", "professional", "friendly", "direct"].includes(String(settingValue))) return false;
                  next.personality = String(settingValue);
                } else if ([
                  "autonomousMode", "campaignMonitoring", "allowCampaignExecution", "allowCampaignScheduling",
                  "preSendReview", "warnOnRisk", "monitorDelivery", "notifyHighRisk", "notifyCampaignIssues", "notifyRecommendations",
                ].includes(field)) {
                  if (!["true", "false"].includes(String(settingValue).toLowerCase())) return false;
                  next[field] = String(settingValue).toLowerCase() === "true";
                } else {
                  return false;
                }
                await saveRexConfig({ data: next as any });
                return true;
              } catch { return false; }
            }
'''
        # replace opening only once
        a = a.replace(marker, insert, 1)
        print("rex handler injected")
    else:
        print("WARN onUpdateWorkspaceSetting marker not found")
else:
    print("rex handler already present")

app.write_text(a)
print("app size", app.stat().st_size)
print("done")
