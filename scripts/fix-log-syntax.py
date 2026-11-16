#!/usr/bin/env python3
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")

broken = '''      if (kind) {
        showSystemNotification("Elite Connectere", msg, settings.notifications[kind]);
        // Finish campaign = repeating alarm. Start / other events = short notification tone.
        if (kind === "campaignCompleted") {
          playAlarmRingtone(settings.alarmRingtone || settings.notificationSound, settings.sounds !== false);
          vibrate([80, 40, 80, 40, 80], settings.vibration !== false);
        } else {
          playSound(settings.notificationSound, settings.sounds !== false);
          vibrate([55, 45, 55], settings.vibration !== false);
        }
      } else {
          playSound(settings.notificationSound, settings.sounds !== false);
          vibrate([55, 45, 55], settings.vibration !== false);
        }
      }
    },'''

fixed = '''      if (kind) {
        showSystemNotification("Elite Connectere", msg, settings.notifications[kind]);
        // Finish campaign = repeating alarm. Start / other events = short notification tone.
        if (kind === "campaignCompleted") {
          playAlarmRingtone(settings.alarmRingtone || settings.notificationSound, settings.sounds !== false);
          vibrate([80, 40, 80, 40, 80], settings.vibration !== false);
        } else {
          playSound(settings.notificationSound, settings.sounds !== false);
          vibrate([55, 45, 55], settings.vibration !== false);
        }
      }
    },'''

if broken in text:
    text = text.replace(broken, fixed, 1)
    path.write_text(text, encoding="utf-8")
    print("✓ Fixed log() brace syntax")
else:
    # try regex
    pat = re.compile(
        r"if \(kind\) \{\s*showSystemNotification\([\s\S]*?\}\s*\}\s*else \{\s*playSound\([\s\S]*?\}\s*\}\s*\},",
        re.M,
    )
    if pat.search(text):
        text = pat.sub(fixed.strip() + "\n", text, count=1)
        path.write_text(text, encoding="utf-8")
        print("✓ Fixed log() via regex")
    else:
        print("· pattern not found — already fixed?")
        # still verify balance near log
        idx = text.find("const log = useCallback")
        print(text[idx:idx+900] if idx>=0 else "no log")
