from pathlib import Path
p = Path("src/routes/app.tsx")
t = p.read_text()
if "PromoChip" not in t:
    t = t.replace(
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";',
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";\nimport { PromoChip } from "@/features/billing/PromoBanner";',
        1,
    )
    # place near brand title if possible
    if "Elite <span" in t and "<PromoChip" not in t:
        t = t.replace(
            'Elite <span className="text-brand">Connectere</span>',
            'Elite <span className="text-brand">Connectere</span>{" "}<PromoChip onOpenPlans={() => setPremiumReason("November promo ends soon — see plans for after the free month.")} />',
            1,
        )
        print("chip near title")
    elif "<PromoChip" not in t:
        t = t.replace(
            "{entitlements?.planEndsAt",
            '{entitlements?.communityPromo && <PromoChip onOpenPlans={() => setPremiumReason("See plans after November promo.")} />}\n      {entitlements?.planEndsAt',
            1,
        )
        print("chip near expiry")
    p.write_text(t)
else:
    print("already")
print("done")
