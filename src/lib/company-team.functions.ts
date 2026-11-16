import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function emailOf(claims: unknown) {
  return (claims as { email?: string } | undefined)?.email;
}

export const getCompanyTeamSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCompanySeats } = await import("@/server/company-team.server");
    return listCompanySeats(context.userId, emailOf(context.claims));
  });

export const inviteCompanyTeamSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    return { email };
  })
  .handler(async ({ context, data }) => {
    const { inviteCompanyAdmin } = await import("@/server/company-team.server");
    return inviteCompanyAdmin(context.userId, data.email, emailOf(context.claims));
  });

export const revokeCompanyTeamSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seatId: string }) => {
    const seatId = String(d?.seatId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(seatId)) throw new Error("Invalid Team Seat.");
    return { seatId };
  })
  .handler(async ({ context, data }) => {
    const { revokeCompanyAdmin } = await import("@/server/company-team.server");
    return revokeCompanyAdmin(context.userId, data.seatId, emailOf(context.claims));
  });

export const getMyCompanyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listMyCompanyNotifications } = await import("@/server/company-team.server");
    return listMyCompanyNotifications(context.userId);
  });

export const markMyCompanyNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { markCompanyNotificationsRead } = await import("@/server/company-team.server");
    return markCompanyNotificationsRead(context.userId);
  });
