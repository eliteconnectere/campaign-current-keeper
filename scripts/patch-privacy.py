#!/usr/bin/env python3
from pathlib import Path

p = Path("src/routes/privacy.tsx")
t = p.read_text(encoding="utf-8")

t = t.replace(
    "const UPDATED = \"27 October 2026\";",
    "const UPDATED = \"4 November 2026\";",
)
t = t.replace(
    "Elite Connectere supports up to 10 connected Gmail sending profiles.",
    "The number of connected Gmail sending profiles depends on your active plan or promotional privilege (up to 75 on Elite Studio ProMaxx). Your workspace shows the exact limit for your account.",
)

old = '''        <Section title="Contact us">
          <p>
            For questions about this Privacy Policy, requests concerning personal information,
            deletion requests, or other privacy-related matters, contact:
          </p>
          <p>
            Email: eliteconnectere@gmail.com
            <br />
            Phone: +234 906 412 9297
          </p>
        </Section>'''

new = '''        <Section title="Contact us">
          <p>
            For questions about this Privacy Policy, requests concerning personal information,
            deletion requests, or other privacy-related matters, use Support so your request is
            routed correctly:
          </p>
          <p>
            <Link to="/support" className="font-semibold text-brand underline">
              eliteconnectere.site/support
            </Link>
          </p>
          <p className="text-[12px]">
            Support will direct you to the right channel. Do not send passwords or full campaign
            recipient lists in public messages.
          </p>
        </Section>'''

if old in t:
    t = t.replace(old, new)
    print("Contact section updated")
else:
    print("Contact section anchor not found")

p.write_text(t, encoding="utf-8")
print("privacy.tsx saved", len(t))
