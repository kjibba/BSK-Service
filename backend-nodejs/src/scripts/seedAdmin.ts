import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || "admin";
  const ADMIN_NAME = process.env.ADMIN_NAME || "Administrator";
  const ADMIN_ROLE = (process.env.ADMIN_ROLE || "admin").toLowerCase();
  // NOTE: Password is not used in current auth flow; kept for future compatibility
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

  if (!ADMIN_EMAIL) {
    console.error("Missing ADMIN_EMAIL/ADMIN_USERNAME env.");
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    if ((process.env.DB_SYNC || '').toLowerCase() === 'true') {
      console.log("DB_SYNC=true -> synchronizing schema before seeding...");
      await AppDataSource.synchronize();
    }
    const repo = AppDataSource.getRepository(Employee);
    const email = String(ADMIN_EMAIL).trim().toLowerCase();
    let existing = await repo.findOne({ where: { email } });

    if (existing) {
      let changed = false;
      if ((existing.name || "") !== ADMIN_NAME) { existing.name = ADMIN_NAME; changed = true; }
      if ((existing.role || "").toLowerCase() !== ADMIN_ROLE) { existing.role = ADMIN_ROLE; changed = true; }
      if (changed) {
        await repo.save(existing);
        console.log(`Updated admin employee: ${email}`);
      } else {
        console.log(`Admin employee already up-to-date: ${email}`);
      }
    } else {
      const emp = repo.create({ name: ADMIN_NAME, email, role: ADMIN_ROLE, active: true });
      await repo.save(emp);
      console.log(`Created admin employee: ${email}`);
    }

    if (ADMIN_PASSWORD) {
      console.log("Note: ADMIN_PASSWORD provided but not used in current auth implementation.");
    }
    process.exit(0);
  } catch (e) {
    console.error("Seed admin failed:", e);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
