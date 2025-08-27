import express from "express";
import { AppDataSource } from "../data-source";
import { RouteChoice } from "../entities/RouteChoice";
import { Customer } from "../entities/Customer";
import { requireJwt } from "./auth";

const router = express.Router();

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// POST /api/route-choices  { customer_id, selected_date? }
router.post("/", requireJwt as any, async (req: any, res) => {
  try {
    const { customer_id, selected_date } = req.body || {};
    const cid = Number(customer_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: "customer_id must be an integer" });
    const rcRepo = AppDataSource.getRepository(RouteChoice);
    const rc = new RouteChoice();
    rc.customerId = cid;
    rc.technicianEmail = String(req.jwt?.email || req.session?.user?.email || "");
    rc.selectedDate = selected_date ? new Date(String(selected_date)) : todayDateOnly();
    await rcRepo.save(rc);
    res.status(201).json(rc.toDict());
  } catch (error) {
    console.error("Error creating route choice:", error);
    res.status(500).json({ error: "Failed to create route choice" });
  }
});

// GET /api/route-choices/my_today
router.get("/my_today", requireJwt as any, async (req: any, res) => {
  try {
    const email = String(req.jwt?.email || req.session?.user?.email || "");
    if (!email) return res.status(401).json({ error: "Unauthorized" });
    const rcRepo = AppDataSource.getRepository(RouteChoice);
    const qb = rcRepo.createQueryBuilder("rc")
      .leftJoinAndSelect(Customer, "c", "c.id = rc.customerId")
      .where("rc.technicianEmail = :e", { e: email })
      .andWhere("DATE(rc.selectedDate) = CURDATE()")
      .orderBy("rc.id", "ASC");
    const rows = await qb.getRawMany();
    const out = rows.map((r: any) => ({
      id: r.rc_id,
      technician_email: r.rc_technicianEmail,
      customer_id: r.rc_customerId,
      selected_date: r.rc_selectedDate,
      customer: r.c_id ? {
        id: r.c_id,
        name: r.c_name,
        address: r.c_address,
        postal_code: r.c_postalCode,
        city: r.c_city,
        latitude: r.c_latitude,
        longitude: r.c_longitude,
      } : undefined,
    }));
    res.json(out);
  } catch (error) {
    console.error("Error listing my_today route choices:", error);
    res.status(500).json({ error: "Failed to list route choices" });
  }
});

// DELETE /api/route-choices/:id (only own entries)
router.delete("/:id", requireJwt as any, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const email = String(req.jwt?.email || req.session?.user?.email || "");
    const rcRepo = AppDataSource.getRepository(RouteChoice);
    const found = await rcRepo.findOne({ where: { id } });
    if (!found) return res.status(404).json({ error: "Not found" });
    if ((found.technicianEmail || "") !== email) return res.status(403).json({ error: "Forbidden" });
    await rcRepo.delete(id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting route choice:", error);
    res.status(500).json({ error: "Failed to delete route choice" });
  }
});

export default router;
