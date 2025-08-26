import express from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Visit } from "../entities/Visit";
import { ServiceLog } from "../entities/ServiceLog";

const router = express.Router();

// GET /api/employees - list basic employee info
router.get("/", async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(Employee);
    const employees = await repo.find({ order: { name: "ASC" } });
    res.json(employees.map(e => e.toDict()));
  } catch (err: any) {
    console.error("Error fetching employees:", err?.message || err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }

});

// POST /api/employees - create new employee
router.post("/", async (req, res) => {
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

// GET /api/employees/:id - detail
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
  const repo = AppDataSource.getRepository(Employee);
  const emp = await repo.findOne({ where: { id } });
  if (!emp) return res.status(404).json({ error: "Employee not found" });
  return res.json(emp.toDict());
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// PUT /api/employees/:id - update basic fields
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const { name, email, role, phone, title, active } = req.body || {};
    const repo = AppDataSource.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (name !== undefined) employee.name = name;
    if (email !== undefined) employee.email = email;
    if (role !== undefined) employee.role = role;
    if (phone !== undefined) employee.phone = phone;
    if (title !== undefined) employee.title = title;
    if (active !== undefined) employee.active = !!active;
    await repo.save(employee);
    return res.json(employee.toDict());
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// DELETE /api/employees/:id - remove employee
router.delete("/:id", async (req, res) => {
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

// GET /api/employees/:id/stats - basic activity/efficiency stats
router.get("/:id/stats", async (req, res) => {
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
