import { retentionFor, shouldExpire, type LogisticsObject } from "./ttl_policy.ts";

const event: LogisticsObject = { kind: "shipment-event", key: "events/42.json", createdAt: "2026-01-01T00:00:00.000Z" };
const now = new Date("2026-02-01T00:00:00.000Z");
if (!shouldExpire(event, now, retentionFor(event.kind))) throw new Error("a 31-day event must expire");
if (shouldExpire({ ...event, kind: "proof-of-delivery" }, now, retentionFor("proof-of-delivery"))) throw new Error("a proof file must remain for 90 days");
console.log("TTL decision test passed: the event expires and the proof file remains.");
