import { Num } from "./kit";

export const otifTone = (v: number | null, t: { green: number; amber: number }) =>
  v == null ? "muted" : v * 100 >= t.green ? "good" : v * 100 >= t.amber ? "warn" : "bad";

export function OtifValue({ v, t }: { v: number | null; t: { green: number; amber: number } }) {
  return <Num tone={otifTone(v, t)}>{v == null ? "NA" : (v * 100).toFixed(1) + "%"}</Num>;
}
