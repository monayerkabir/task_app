// Read lazily so `next build` works without secrets configured.
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See README.md > Setup.`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function siteUrl(): string {
  const explicit = optionalEnv("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = optionalEnv("VERCEL_PROJECT_PRODUCTION_URL") ?? optionalEnv("VERCEL_URL");
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export const APP_NAME = "Tick Analytics";
