import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon serverless driver connects over WebSocket/HTTPS — works on serverless
// platforms (Netlify) and networks where raw Postgres (5432) is blocked.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;

function makeClient() {
  // adapter-neon 6.x takes a config object and manages the pool internally.
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads / lambda invocations.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
