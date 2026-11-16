import { ShieldCheck } from "lucide-react";

export function ComplianceNotice() {
  return <aside role="alert" className="border-y border-brand/30 bg-brand-soft px-4 py-4 text-ink">
    <div className="mx-auto flex max-w-5xl items-start gap-3">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      <p className="text-sm leading-relaxed">Google Workspace Policy Compliance Notice: This platform strictly prohibits sending unsolicited commercial emails or spam. You are legally required to only send messages via this integration to contacts who have explicitly consented and opted-in to receive your communications. Violations will result in immediate API termination.</p>
    </div>
  </aside>;
}