#!/usr/bin/env python3
from pathlib import Path

folder = Path("src/routes/rex/index.tsx")
if folder.exists():
    folder.unlink()
    print("removed conflict index")

p = Path("src/routes/learn-more.tsx")
t = p.read_text()
start = t.find('id: "rex-ai"')
if start < 0:
    raise SystemExit("rex-ai missing")
# back to opening brace of object
brace = t.rfind("{", 0, start)
end = t.find('id: "radar-chat"', start)
if end < 0:
    raise SystemExit("radar-chat missing")
# include previous whitespace and exclude radar object start - find comma after previous closing
# replace from brace of rex-ai object through the comma before radar-chat
# find end of rex-ai object: the "}," before radar-chat
chunk_end = t.rfind("}", brace, end)
# include trailing comma/newline
after = t[chunk_end + 1 : end]
# keep one comma separator
NEW = '''{
    id: "rex-ai",
    badge: "Agent Rex",
    title: "Meet Agent Rex — the workspace agent (not a generic chatbot)",
    summary: "Short overview only. Full can / cannot details live on the Agent Rex page.",
    content: [
      "Agent Rex is Elite Connectere's in-app workspace agent. You can ask it to open real places in the product, help prepare campaigns, inspect your live draft after you approve, help with hotspot sharing after you approve, and watch the current campaign through Campaign Monitor — always inside Elite Connectere's rules and plan limits.",
      "Sensitive actions use a real red approval control in chat. Asking something else without approving expires that control. Rex does not invent external routes, does not get your full Gmail inbox, and does not send without your confirmation.",
      "Want the full detail (what it can do, what it cannot do, and warnings)? Open the Agent Rex guide: https://eliteconnectere.site/rex",
    ],
  },
  '''
t2 = t[:brace] + NEW + t[end:]
p.write_text(t2)
print("ok", p.stat().st_size)

# linkify paragraphs once
q = p.read_text()
old = "{sec.content.map((p, idx) => (\n          <p key={idx}>{p}</p>\n        ))}"
if old in q and "https?" not in q[q.find("sec.content.map"):q.find("sec.content.map")+400]:
    new = "{sec.content.map((paragraph, idx) => (\n          <p key={idx}>{paragraph.includes(\"https://\") ? (<a href={\"https://eliteconnectere.site/rex\"} className=\"font-semibold text-brand underline underline-offset-2\">{paragraph}</a>) : paragraph}</p>\n        ))}"
    # better simple: always render text; if contains URL split
    new = '''{sec.content.map((paragraph, idx) => {
          const parts = paragraph.split(/(https?:\\/\\/[^\\s]+)/g);
          return (
            <p key={idx}>
              {parts.map((part, i) =>
                /^https?:\\/\\//.test(part) ? (
                  <a key={i} href={part} className="font-semibold text-brand underline underline-offset-2">{part.replace(/^https?:\\/\\//, "")}</a>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          );
        })}'''
    q = q.replace(old, new, 1)
    p.write_text(q)
    print("linkify")
