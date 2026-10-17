function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Run \`neon env pull\` to create .env.local.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8000),
  // Unset listens on all interfaces (IPv4 and IPv6).
  host: process.env.HOST || undefined,
  databaseUrl: required("DATABASE_URL"),
};
