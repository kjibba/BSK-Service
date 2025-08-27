import { AppDataSource } from "../data-source";

async function main() {
  await AppDataSource.initialize();
  try {
    const rows = await AppDataSource.query(
      "SELECT COUNT(*) AS c FROM customers WHERE active=1"
    );
    const row = rows && rows[0] ? rows[0] : { c: 0 };
    const count = (row.c ?? row.C ?? Object.values(row)[0]) as number;
    console.log("Active customers:", count);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
