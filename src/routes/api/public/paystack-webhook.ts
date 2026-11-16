import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifySignature, verifyAndActivate } = await import("@/server/paystack.server");
        if (!(await verifySignature(raw, request.headers.get("x-paystack-signature")))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        const ref = event.data?.reference;
        if (event.event === "charge.success" && typeof ref === "string") {
          // Re-verifies with Paystack; idempotent per reference.
          await verifyAndActivate(ref);
        }
        return new Response("ok");
      },
    },
  },
});
