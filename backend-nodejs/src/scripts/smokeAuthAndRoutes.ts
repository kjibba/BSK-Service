import { AppDataSource } from "../data-source";

async function main() {
  await AppDataSource.initialize();
  try {
    // Pick any employee to log in
    const rows = await AppDataSource.query("SELECT id, email, name, role FROM employees ORDER BY id");
    if (!rows.length) {
      console.log("No employees found to test login.");
      return;
    }
    const admin = rows.find((r: any) => {
      const role = String(r.role || r.ROLE || "").toLowerCase();
      return role === "admin" || role === "manager";
    });
    const user = admin || rows[0];
    const base = process.env.BASE_URL || "http://localhost:8000";

    // Login to get token
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email })
    });
    const loginJson: any = await loginRes.json().catch(() => ({}));
    console.log("login status", loginRes.status, "user", user.email);
    const token = loginJson?.token as string | undefined;
    console.log("token present:", !!token);

    // Protected: visits/report
    if (token) {
      const r1 = await fetch(`${base}/api/visits/report?startDate=2024-01-01`, {
        headers: { authorization: `Bearer ${token}` }
      });
      console.log("/api/visits/report status:", r1.status);

      // Protected: customers/inactive
      const r2 = await fetch(`${base}/api/customers/inactive`, {
        headers: { authorization: `Bearer ${token}` }
      });
      console.log("/api/customers/inactive status:", r2.status);
    }

    // Unprotected: my_missions
    const r3 = await fetch(`${base}/api/visits/my_missions`);
    console.log("/api/visits/my_missions status:", r3.status);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
