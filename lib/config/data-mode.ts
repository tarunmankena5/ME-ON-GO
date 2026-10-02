export type DataMode = "demo" | "supabase";

export function getDataMode(): DataMode {
  const configuredMode = process.env.LIFELOG_DATA_MODE?.trim().toLowerCase();

  if (configuredMode === undefined || configuredMode === "") {
    return "demo";
  }

  if (configuredMode === "demo" || configuredMode === "supabase") {
    return configuredMode;
  }

  throw new Error("LIFELOG_DATA_MODE must be either 'demo' or 'supabase'.");
}
