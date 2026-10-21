// Radar Ledger のスター推移（scripts/snapshot_ledger.mjs が作る data/derived/velocity.json）。
// まだ無い（スナップショット前）ときは null。data/ は public/ ではないので、このファイル自体はサイトに配信されない
const files = import.meta.glob("../../data/derived/velocity.json", { eager: true, import: "default" });
export const velocity = Object.values(files)[0] || null;
