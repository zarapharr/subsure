import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "src/db/migrations" });
  await client.end();
  console.log("migrations applied");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
