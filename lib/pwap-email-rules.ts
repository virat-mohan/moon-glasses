// Who gets which Pay With A Post email. Pure.

export function dedupeEmails(list: string[]): string[] {
  return [...new Map(list.map((e) => [e.trim().toLowerCase(), e.trim()] as const).filter(([k]) => k)).values()];
}

/** A PWAP order that has not qualified (and is not shipping on trust) is not shippable: the warehouse must not see it. */
export function isUnshippableBarter(order: { payment_status?: string | null; barter_qualified_at?: string | null }): boolean {
  return order.payment_status === "barter_pending" && !order.barter_qualified_at;
}

/** Recipients of the generic "New order confirmed" team email. */
export function orderNotificationRecipients(
  order: { payment_status?: string | null; barter_qualified_at?: string | null; is_test?: boolean | null },
  team: string[],
  founder: string,
  warehouse: string[]
): string[] {
  const includeWarehouse = !order.is_test && !isUnshippableBarter(order);
  return dedupeEmails([...team, founder, ...(includeWarehouse ? warehouse : [])]);
}

/** Recipients of the dedicated PWAP team email: team + founder, never the warehouse. */
export function pwapTeamRecipients(team: string[], founder: string): string[] {
  return dedupeEmails([...team, founder]);
}

export function pwapTeamSubject(orderNumber: string, salesToShip: number): string {
  return `New Pay With A Post order — #${orderNumber} (post first, ships after ${salesToShip} sales)`;
}
