export type LogisticsObject = {
  kind: "shipment-event" | "proof-of-delivery" | "exception";
  key: string;
  createdAt: string;
};

export function shouldExpire(object: LogisticsObject, now: Date, ttlDays: number): boolean {
  const age = now.getTime() - new Date(object.createdAt).getTime();
  return age >= ttlDays * 24 * 60 * 60 * 1000;
}

export function retentionFor(kind: LogisticsObject["kind"]): number {
  return kind === "proof-of-delivery" ? 90 : 30;
}
