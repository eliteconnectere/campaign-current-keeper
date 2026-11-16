from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text()

# Delay / pacing learn more → #pacing-delay
t2 = t.replace(
    'href="/learn-more"',
    'href="/learn-more#pacing-delay"',
)
# If multiple generic links, refine protection one if present
if "Permanent Send Protection" in t2 or "permanentSendProtection" in t2:
    # protection-related learn more often near that feature — leave first as pacing if only one
    pass

# Explicit best-practices link text
t2 = t2.replace(
    'href="/learn-more#pacing-delay" target="_blank" rel="noreferrer" className="mt-1 inline-block',
    'href="/learn-more#pacing-delay" target="_blank" rel="noreferrer" className="mt-1 inline-block',
)

# Second occurrence style: Email Sending Best Practices → #best-practices
# Replace only the practices-labeled anchor if plain /learn-more remains
if 'Learn more: Email Sending Best Practices' in t2:
    # find nearby href
    import re
    t2 = re.sub(
        r'(Learn more: Email Sending Best Practices[^<]*)',
        lambda m: m.group(0),
        t2,
    )
    # Fix the href immediately before that text pattern
    t2 = t2.replace(
        'href="/learn-more#pacing-delay"',
        'href="/learn-more#pacing-delay"',
        1,
    )
    # If there is still a plain learn-more for practices, set it
    idx = t2.find("Email Sending Best Practices")
    if idx > 0:
        window = t2[max(0, idx - 200):idx]
        if 'href="/learn-more"' in window:
            t2 = t2[: max(0, idx - 200)] + window.replace(
                'href="/learn-more"', 'href="/learn-more#best-practices"'
            ) + t2[idx:]
            print("OK: best-practices deep link")

# Generic remaining /learn-more without hash → two-modes (who controls what)
# Only replace plain ones carefully
count = 0
parts = []
i = 0
while True:
    j = t2.find('href="/learn-more"', i)
    if j < 0:
        parts.append(t2[i:])
        break
    parts.append(t2[i:j])
    parts.append('href="/learn-more#two-modes"')
    i = j + len('href="/learn-more"')
    count += 1
t2 = "".join(parts)
if count:
    print(f"OK: {count} generic learn-more → #two-modes")

p.write_text(t2)
print("done")
