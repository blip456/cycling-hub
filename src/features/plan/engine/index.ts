/** Public API of the plan engine: pure, deterministic, UI-free and Supabase-free. */
export * from "./budget";
export * from "./build";
export * from "./calendar";
export * from "./constants";
export * from "./fingerprint";
export * from "./history";
export * from "./level";
export * from "./library";
export * from "./mix";
export * from "./settings";
export { hasUsableFtp, resolveInput, type ResolvedInput } from "./resolve";
export * from "./types";
export * from "./weight-loss";
export { allocateMinutes, assignDays, dayIndices } from "./allocate";
