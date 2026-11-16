export type ConsentConfirmation = { scope: string; confirmed: boolean } | null;

export function canSendCustomerMessage(reviewMode: boolean, consent: ConsentConfirmation, scope: string) {
  return !reviewMode || (consent?.confirmed === true && consent.scope === scope);
}

export function customerConsentScope(contacts: string[], selected: string, subject: string, body: string) {
  return JSON.stringify([contacts, selected, subject, body]);
}