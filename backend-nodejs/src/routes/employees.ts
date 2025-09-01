import express from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Visit } from "../entities/Visit";
import { ServiceLog } from "../entities/ServiceLog";
import { requireAuthenticated, requireAdmin, requireJwt } from "./auth";

const router = express.Router();

// GET /api/employees - list basic employee info (authenticated)
router.get("/", requireAuthenticated, async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(Employee);
    // Prøv full entitet først (nytt skjema)
    try {
      const employees = await repo.find({ order: { name: "ASC" } });
      return res.json(employees.map(e => e.toDict()));
    } catch (e: any) {
      // Fallback: prøv å ta med role hvis kolonnen finnes, ellers uten role
      try {
        const rows = await repo.createQueryBuilder('e')
          .select(['e.id','e.name','e.email','e.role'])
          .orderBy('e.name','ASC')
          .getRawMany();
        const out = rows.map((r: any) => ({ id: r.e_id ?? r.id, name: r.e_name ?? r.name, email: r.e_email ?? r.email, role: (r as any).e_role ?? (r as any).role ?? '' }));
        return res.json(out);
      } catch {
        const rows = await repo.createQueryBuilder('e')
          .select(['e.id','e.name','e.email'])
          .orderBy('e.name','ASC')
          .getRawMany();
        const out = rows.map((r: any) => ({ id: r.e_id ?? r.id, name: r.e_name ?? r.name, email: r.e_email ?? r.email, role: '' }));
        return res.json(out);
      }
    }
  } catch (err: any) {
    console.error("Error fetching employees:", err?.message || err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// POST /api/employees - create new employee (admin/manager)
router.post("/", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const { name, email, role, phone, title, active } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
  const repo = AppDataSource.getRepository(Employee);
  const emp = repo.create({ name, email, role, phone, title, active: active !== undefined ? !!active : true });
  await repo.save(emp);
  return res.status(201).json(emp.toDict());
  } catch (err: any) {
    console.error("Error creating employee:", err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// GET /api/employees/:id - detail (authenticated)
router.get("/:id", requireAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const repo = AppDataSource.getRepository(Employee);
    try {
      const emp = await repo.findOne({ where: { id } });
      if (!emp) return res.status(404).json({ error: "Employee not found" });
      return res.json(emp.toDict());
    } catch {
      try {
        const row = await repo.createQueryBuilder('e')
          .select(['e.id','e.name','e.email','e.role'])
          .where('e.id = :id', { id })
          .getRawOne();
        if (!row) return res.status(404).json({ error: "Employee not found" });
        return res.json({ id: row.e_id ?? row.id, name: row.e_name ?? row.name, email: row.e_email ?? row.email, role: (row as any).e_role ?? (row as any).role ?? '' });
      } catch {
        const row = await repo.createQueryBuilder('e')
          .select(['e.id','e.name','e.email'])
          .where('e.id = :id', { id })
          .getRawOne();
        if (!row) return res.status(404).json({ error: "Employee not found" });
        return res.json({ id: row.e_id ?? row.id, name: row.e_name ?? row.name, email: row.e_email ?? row.email, role: '' });
      }
    }
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// PUT /api/employees/:id - update basic fields (admin/manager)
router.put("/:id", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const { name, email, role, phone, title, active } = req.body || {};
    const repo = AppDataSource.getRepository(Employee);

    // Minimal eksistenssjekk (unngå SELECT * som kan feile på manglende kolonner)
    const exists = await AppDataSource
      .createQueryBuilder()
      .select(["e.id"]).from(Employee, "e")
      .where("e.id = :id", { id })
      .getRawOne();
    if (!exists) return res.status(404).json({ error: "Employee not found" });

    // Oppdater felt én og én for å kunne hoppe over kolonner som ikke finnes i eldre skjema
    const updates: Array<{ field: string; value: any }> = [];
    if (name !== undefined) updates.push({ field: "name", value: name });
    if (email !== undefined) updates.push({ field: "email", value: email });
    if (role !== undefined) updates.push({ field: "role", value: role });
    if (phone !== undefined) updates.push({ field: "phone", value: phone });
    if (title !== undefined) updates.push({ field: "title", value: title });
    if (active !== undefined) updates.push({ field: "active", value: !!active });

    let applied = 0;
    const skipped: string[] = [];
    for (const u of updates) {
      try {
        const setObj: any = { [u.field]: u.value };
        const result = await repo.createQueryBuilder()
          .update(Employee)
          .set(setObj)
          .where("id = :id", { id })
          .execute();
        if ((result as any)?.affected) applied += Number((result as any).affected || 0);
      } catch (e: any) {
        // Ukjent kolonne → hopp over og noter
        if (e && (e.code === 'ER_BAD_FIELD_ERROR' || String(e.message||'').includes('Unknown column'))) {
          skipped.push(u.field);
          continue;
        }
        throw e;
      }
    }

    // Hent et minimalt resultat å returnere (id, name, email, role)
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id","e.name","e.email","e.role"]).from(Employee, "e")
      .where("e.id = :id", { id })
      .getRawOne();
    const payload: any = row ? {
      id: row.e_id ?? row.id,
      name: row.e_name ?? row.name,
      email: row.e_email ?? row.email,
      role: (row as any)?.e_role ?? (row as any)?.role ?? "",
    } : { id };

    if (skipped.length && applied === 0 && updates.length > 0) {
      // Alt ble hoppet over pga. manglende kolonner
      return res.status(400).json({ error: `Unsupported fields in current database schema: ${skipped.join(', ')}`, employee: payload });
    }
    return res.json(payload);
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// DELETE /api/employees/:id - remove employee (admin/manager)
router.delete("/:id", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const repo = AppDataSource.getRepository(Employee);
    const emp = await repo.findOne({ where: { id } });
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    await repo.remove(emp);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

// GET /api/employees/:id/stats - basic activity/efficiency stats (authenticated)
router.get("/:id/stats", requireAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });

    const visitRepo = AppDataSource.getRepository(Visit);
    const logRepo = AppDataSource.getRepository(ServiceLog);

    const [visitsAssigned, visitsCompleted, hoursSum] = await Promise.all([
      visitRepo.count({ where: { assignedTechnicianId: id } }),
      visitRepo.count({ where: { assignedTechnicianId: id, status: "Fullført" } }),
      logRepo
        .createQueryBuilder("log")
        .leftJoin(Visit, "v", "v.id = log.visit_id")
        .where("v.assigned_technician_id = :id", { id })
        .select("SUM(log.hours_worked)", "hours")
        .getRawOne()
        .then((r:any) => Number(r?.hours || 0)),
    ]);

    res.json({
      assigned_visits: visitsAssigned,
      completed_visits: visitsCompleted,
      total_hours_logged: hoursSum,
      efficiency: visitsAssigned ? (visitsCompleted / visitsAssigned) : null,
    });
  } catch (err) {
    console.error("Error computing employee stats:", err);
    res.status(500).json({ error: "Failed to compute stats" });
  }
});

export default router;
