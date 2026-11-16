import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyCheckout } from "@/lib/paystack.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/billing/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirming payment — Elite Connectere" },
      { name: "description", content: "Confirming your Elite Connectere subscription payment." },
      { property: "og:title", content: "Confirming payment — Elite Connectere" },
      { property: "og:description", content: "Confirming your Elite Connectere subscription payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const verify = useServerFn(verifyCheckout);
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Confirming your payment with Paystack…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) {
      setMsg("No payment reference was returned.");
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Please log in again — your payment will be confirmed automatically.");
        return;
      }
      try {
        const r = await verify({ data: { reference } });
        if (r.ok) {
          if (!r.already) {
            // Balloons + confetti only for a verified Plan 3 activation.
            if (r.plan === "plan3") sessionStorage.setItem("ec_celebrate", "1");
            else sessionStorage.setItem("ec_upgraded", String(r.plan));
          }
          void navigate({ to: "/app" });
        } else {
          setMsg(`Payment not confirmed (${r.reason}). If you were charged, it will activate shortly.`);
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not confirm payment.");
      }
    })();
  }, [verify, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
      <div>
        <p className="text-[16px] font-bold text-ink">Elite Connectere</p>
        <p className="mt-2 text-[13px] text-ink-soft">{msg}</p>
        <a href="/app" className="mt-4 inline-block text-[12.5px] font-semibold text-brand">
          Back to workspace
        </a>
      </div>
    </main>
  );
}
