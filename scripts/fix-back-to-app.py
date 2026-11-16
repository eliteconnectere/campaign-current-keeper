#!/usr/bin/env python3
"""Fix misleading 'Back to app' links that actually go to homepage."""
from pathlib import Path

fixes = {
    "src/routes/privacy.tsx": [
        ('to="/" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
         'to="/app" className="text-[12.5px] font-semibold text-brand">\n            Back to app'),
    ],
    "src/routes/learn-more.tsx": [
        ('<Link to="/" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to Elite Connectere',
         '<Link to="/app" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to workspace'),
        ('to="/">← Back to Elite Connectere', 'to="/app">← Back to workspace'),
    ],
    "src/routes/terms.tsx": [
        ('Back to app', None),  # find and fix to= nearby via generic
    ],
}

# Generic: any "Back to app" near to="/"
for path in ["src/routes/privacy.tsx", "src/routes/terms.tsx", "src/routes/learn-more.tsx"]:
    p = Path(path)
    if not p.exists():
        print("skip missing", path)
        continue
    text = p.read_text(encoding="utf-8")
    orig = text
    # Privacy-style
    text = text.replace(
        'Link to="/" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
        'Link to="/app" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
    )
    text = text.replace(
        'to="/" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
        'to="/app" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
    )
    # Learn more header
    text = text.replace(
        'Link to="/" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to Elite Connectere',
        'Link to="/app" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to workspace',
    )
    text = text.replace(
        'to="/" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to Elite Connectere',
        'to="/app" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to workspace',
    )
    # Review pages may use to="/"
    if "Back to app" in text and 'to="/app"' not in text:
        text = text.replace('to="/">Back to app', 'to="/app">Back to app')
        text = text.replace("to='/'>Back to app", "to='/app'>Back to app")
    if text != orig:
        p.write_text(text, encoding="utf-8")
        print("updated", path)
    else:
        print("no change", path)

# ReviewPages if present
rp = Path("src/features/review/ReviewPages.tsx")
if rp.exists():
    t = rp.read_text(encoding="utf-8")
    o = t
    t = t.replace('to="/">Back to app', 'to="/app">Back to app')
    t = t.replace('to="/" className', 'to="/app" className')  # careful - only back links preferred
    # only replace Back-related - skip broad replace
    t = o
    t = t.replace(
        'Link to="/" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
        'Link to="/app" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
    )
    if t != o:
        rp.write_text(t, encoding="utf-8")
        print("updated ReviewPages")
    else:
        print("ReviewPages unchanged")

print("done")
