import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

export class MissingEnvError extends Error {
  constructor(readonly variables: string[]) {
    super(
      `Missing or invalid environment variables: ${variables.join(", ")}. ` +
        "Copy .env.example to .env.local and fill in the Supabase API URL and publishable key.",
    );
    this.name = "MissingEnvError";
  }
}

/** Validates the client env. Throws MissingEnvError with the names of the bad variables. */
export function parseEnv(source: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new MissingEnvError(names);
  }
  return result.data;
}
