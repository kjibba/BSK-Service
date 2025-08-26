import express from "express";
import { AppDataSource } from "../data-source";
import { Visit } from "../entities/Visit";
import { Customer } from "../entities/Customer";
import { ServiceLog } from "../entities/ServiceLog";
import { Employee } from "../entities/Employee";
import { Equipment } from "../entities/Equipment";
import { In } from "typeorm";

const router = express.Router();
// Separate router for office-specific listing to avoid '/:id' conflicts
export const officeVisitsRouter = express.Router();

// GET /api/visits
router.get("/", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const { customer_id, technician_email, status } = req.query;

    let query = visitRepository.createQueryBuilder("visit")
      .leftJoinAndSelect("visit.customer", "customer");

    if (customer_id !== undefined) {
      const cid = Number(customer_id);
      if (!Number.isInteger(cid)) {
        return res.status(400).json({ error: "customer_id must be an integer" });
      }
      query = query.where("visit.customerId = :customerId", { customerId: cid });
    }

    if (technician_email) {
      query = query.andWhere("visit.technician = :technician", { 
        technician: technician_email 
      });
    }

    if (status) {
      query = query.andWhere("visit.status = :status", { status });
    }

    const visits = await query
      .orderBy("visit.visitDate", "DESC")
      .getMany();

    res.json(visits.map(v => v.toDict()));
  } catch (error) {
    console.error("Error fetching visits:", error);
    res.status(500).json({ error: "Failed to fetch visits" });
  }
});

// GET /api/visits/my_missions - lightweight view for technicians
router.get("/my_missions", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const { technician_email, assigned_technician_id, status } = req.query as any;

    let qb = visitRepository.createQueryBuilder("visit").leftJoinAndSelect("visit.customer", "customer");

    // Filter by technician email or assigned technician id
    if (technician_email) {
      qb = qb.andWhere("visit.technician = :t", { t: String(technician_email) });
    }
    if (assigned_technician_id !== undefined) {
      const techId = Number(assigned_technician_id);
      if (!Number.isNaN(techId)) {
        qb = qb.andWhere("visit.assignedTechnicianId = :tid", { tid: techId });
      }
    }

    // Default to planned/ongoing if not specified
    if (status) {
      qb = qb.andWhere("visit.status = :s", { s: String(status) });
    } else {
      qb = qb.andWhere("visit.status IN (:...st)", { st: ["Planlagt", "Pågående"] });
    }

    const items = await qb.orderBy("visit.visitDate", "ASC").getMany();
    const out = items.map(v => {
      const obj: any = v.toDict();
      try {
        const c: any = (v as any).customer;
        if (c) {
          obj.customer_name = c.name ?? undefined;
          obj.customer_address = c.address ?? undefined;
          obj.customer_postal_code = c.postalCode ?? undefined;
          obj.customer_city = c.city ?? undefined;
        }
      } catch (_) {}
      return obj;
    });
    res.json(out);
  } catch (error) {
    console.error("Error fetching my_missions:", error);
    res.status(500).json({ error: "Failed to fetch missions" });
  }
});

// POST /api/visits
router.post("/", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const { customer_id, visit_date, technician, notes, status } = req.body;

    if (!customer_id || !visit_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const visit = new Visit();
    visit.customerId = customer_id;
    visit.visitDate = new Date(visit_date);
    visit.technician = technician;
    visit.notes = notes;
    visit.status = status || "Planlagt";

    await visitRepository.save(visit);
    res.status(201).json(visit.toDict());
  } catch (error) {
    console.error("Error creating visit:", error);
    res.status(500).json({ error: "Failed to create visit" });
  }
});

// POST /api/office/visits - create visit from office
officeVisitsRouter.post("/", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const { customer_id, visit_date, assigned_technician_id, notes, technician } = req.body || {};
    const cid = Number(customer_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: "customer_id must be an integer" });
    if (!visit_date) return res.status(400).json({ error: "visit_date is required" });

    const v = new Visit();
    v.customerId = cid;
    v.visitDate = new Date(visit_date);
    v.status = "Planlagt";
    if (notes !== undefined) v.notes = notes;
    if (technician !== undefined) v.technician = technician;
    if (assigned_technician_id !== undefined) {
      const tid = Number(assigned_technician_id);
      if (!Number.isNaN(tid)) v.assignedTechnicianId = tid;
    }
    await visitRepository.save(v);
    res.status(201).json(v.toDict());
  } catch (error) {
    console.error("Error creating office visit:", error);
    res.status(500).json({ error: "Failed to create visit" });
  }
});

// GET /api/visits/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const visitRepository = AppDataSource.getRepository(Visit);
    const visit = await visitRepository.findOne({
      where: { id },
      relations: ["customer", "serviceLogs"]
    });

    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }

    res.json(visit.toDict());
  } catch (error) {
    console.error("Error fetching visit:", error);
    res.status(500).json({ error: "Failed to fetch visit" });
  }
});

// GET /api/visits/:id/detail - include logs and equipment names
router.get("/:id/detail", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const visitRepo = AppDataSource.getRepository(Visit);
    const logRepo = AppDataSource.getRepository(ServiceLog);
    const equipRepo = AppDataSource.getRepository(Equipment);

    const visit = await visitRepo.findOne({ where: { id }, relations: ["customer"] });
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    const logs = await logRepo.find({ where: { visitId: id }, order: { logDate: "DESC" } });
    // Optionally attach equipment names
    const eqIds = Array.from(new Set(logs.map(l => l.equipmentId))).filter(Boolean) as number[];
    const names = new Map<number, string>();
    if (eqIds.length) {
      const list = await equipRepo.find({ where: { id: In(eqIds) } });
      list.forEach(e => names.set(e.id, e.name || "Utstyr"));
    }
    const logObjs = logs.map(l => ({ ...l.toDict(), equipment_name: names.get(l.equipmentId) }));

    res.json({ visit: visit.toDict(), customer: visit.customer?.toDict?.() || undefined, logs: logObjs });
  } catch (error) {
    console.error("Error fetching visit detail:", error);
    res.status(500).json({ error: "Failed to fetch visit detail" });
  }
});

// POST /api/visits/:id/start - mark as started
router.post("/:id/start", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const visitRepo = AppDataSource.getRepository(Visit);
    const visit = await visitRepo.findOne({ where: { id } });
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const at = (req.query?.started_at as string) || (req.body?.started_at as string);
    visit.startedAt = at ? new Date(at) : new Date();
    visit.status = "Pågående";
    await visitRepo.save(visit);
    res.json(visit.toDict());
  } catch (error) {
    console.error("Error starting visit:", error);
    res.status(500).json({ error: "Failed to start visit" });
  }
});

// GET /api/visits/:id/logs - list logs for a visit
router.get("/:id/logs", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const logRepo = AppDataSource.getRepository(ServiceLog);
    const equipRepo = AppDataSource.getRepository(Equipment);
    const logs = await logRepo.find({ where: { visitId: id }, order: { logDate: "DESC" } });
    const eqIds = Array.from(new Set(logs.map(l => l.equipmentId))).filter(Boolean) as number[];
    const names = new Map<number, string>();
    if (eqIds.length) {
      const list = await equipRepo.find({ where: { id: In(eqIds) } });
      list.forEach(e => names.set(e.id, e.name || "Utstyr"));
    }
    res.json(logs.map(l => ({ ...l.toDict(), equipment_name: names.get(l.equipmentId) })));
  } catch (error) {
    console.error("Error listing visit logs:", error);
    res.status(500).json({ error: "Failed to list logs" });
  }
});

// POST /api/visits/:id/logs - create a new service log for a visit
router.post("/:id/logs", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const { equipment_id, description, hours_worked, log_date } = req.body || {};
    const eid = Number(equipment_id);
    if (!Number.isInteger(eid)) return res.status(400).json({ error: "equipment_id must be an integer" });
    if (!description || String(description).trim() === "") return res.status(400).json({ error: "description is required" });

    const logRepo = AppDataSource.getRepository(ServiceLog);
    const equipRepo = AppDataSource.getRepository(Equipment);
    const equip = await equipRepo.findOne({ where: { id: eid } });
    if (!equip) return res.status(404).json({ error: "Equipment not found" });

    const log = new ServiceLog();
    log.visitId = id;
    log.equipmentId = eid;
    log.description = String(description);
    if (hours_worked !== undefined) {
      const h = Number(hours_worked);
      if (!Number.isNaN(h)) log.hoursWorked = h;
    }
    log.logDate = log_date ? new Date(log_date) : new Date();
    await logRepo.save(log);
    res.status(201).json(log.toDict());
  } catch (error) {
    console.error("Error creating visit log:", error);
    res.status(500).json({ error: "Failed to create log" });
  }
});

// POST /api/visits/:id/complete - mark visit as completed
router.post("/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const { completed_at, oppsummering_notat, sjekk_advarselskilt, sjekk_agnstasjoner, sjekk_inngangspunkter, sjekk_fellefangst } = req.body || {};
    const repo = AppDataSource.getRepository(Visit);
    const visit = await repo.findOne({ where: { id } });
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.completedAt = completed_at ? new Date(completed_at) : new Date();
    visit.status = "Fullført";
    if (oppsummering_notat !== undefined) visit.oppsummeringNotat = oppsummering_notat;
    if (sjekk_advarselskilt !== undefined) visit.sjekkAdvarselskilt = !!sjekk_advarselskilt;
    if (sjekk_agnstasjoner !== undefined) visit.sjekkAgnstasjoner = !!sjekk_agnstasjoner;
    if (sjekk_inngangspunkter !== undefined) visit.sjekkInngangspunkter = !!sjekk_inngangspunkter;
    if (sjekk_fellefangst !== undefined) visit.sjekkFellefangst = !!sjekk_fellefangst;
    await repo.save(visit);
    res.json(visit.toDict());
  } catch (error) {
    console.error("Error completing visit:", error);
    res.status(500).json({ error: "Failed to complete visit" });
  }
});

// POST /api/visits/:id/assign - assign technician
router.post("/:id/assign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const { assigned_technician_id } = req.body || {};
    const tid = Number(assigned_technician_id);
    if (!Number.isInteger(tid)) return res.status(400).json({ error: "assigned_technician_id must be an integer" });
    const repo = AppDataSource.getRepository(Visit);
    const visit = await repo.findOne({ where: { id } });
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.assignedTechnicianId = tid;
    await repo.save(visit);
    res.json(visit.toDict());
  } catch (error) {
    console.error("Error assigning technician:", error);
    res.status(500).json({ error: "Failed to assign technician" });
  }
});

// PUT /api/visits/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const visitRepository = AppDataSource.getRepository(Visit);
    const visit = await visitRepository.findOne({
      where: { id }
    });

    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }

    const { visit_date, technician, notes, status, started_at, completed_at } = req.body;

    if (visit_date !== undefined) visit.visitDate = new Date(visit_date);
    if (technician !== undefined) visit.technician = technician;
    if (notes !== undefined) visit.notes = notes;
    if (status !== undefined) visit.status = status;
    if (started_at !== undefined) visit.startedAt = started_at ? new Date(started_at) : undefined;
    if (completed_at !== undefined) visit.completedAt = completed_at ? new Date(completed_at) : undefined;

    await visitRepository.save(visit);
    res.json(visit.toDict());
  } catch (error) {
    console.error("Error updating visit:", error);
    res.status(500).json({ error: "Failed to update visit" });
  }
});

// DELETE /api/visits/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const visitRepository = AppDataSource.getRepository(Visit);
    const result = await visitRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Visit not found" });
    }

    res.json({ message: "Visit deleted successfully" });
  } catch (error) {
    console.error("Error deleting visit:", error);
    res.status(500).json({ error: "Failed to delete visit" });
  }
});

// POST /api/visits/batch_delete - delete multiple planned visits by ids
router.post("/batch_delete", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }
    const idNums = ids.map((x: any) => Number(x)).filter(n => Number.isInteger(n));
    if (idNums.length !== ids.length) {
      return res.status(400).json({ error: "ids must be integers" });
    }
    const repo = AppDataSource.getRepository(Visit);
    // Only delete visits that are currently planned
    const toDelete = await repo.find({ where: { id: In(idNums), status: "Planlagt" } as any });
    const delIds = toDelete.map(v => v.id);
    if (delIds.length) {
      await repo.delete(delIds);
    }
    const notDeleted = idNums.filter(id => !delIds.includes(id));
    res.json({ deleted_count: delIds.length, deleted_ids: delIds, skipped_ids: notDeleted });
  } catch (error) {
    console.error("Error batch deleting visits:", error);
    res.status(500).json({ error: "Failed to batch delete visits" });
  }
});

// GET /api/office/visits - Office-specific visits endpoint
officeVisitsRouter.get("/", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const visits = await visitRepository.find({
      relations: ["customer"],
      order: { visitDate: "DESC" }
    });

    res.json(visits.map(v => v.toDict()));
  } catch (error) {
    console.error("Error fetching office visits:", error);
    res.status(500).json({ error: "Failed to fetch office visits" });
  }
});

// POST /api/office/visits/:id/assign - office assign helper
officeVisitsRouter.post("/:id/assign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const { assigned_technician_id } = req.body || {};
    const tid = Number(assigned_technician_id);
    if (!Number.isInteger(tid)) return res.status(400).json({ error: "assigned_technician_id must be an integer" });
    const repo = AppDataSource.getRepository(Visit);
    const v = await repo.findOne({ where: { id } });
    if (!v) return res.status(404).json({ error: "Visit not found" });
    v.assignedTechnicianId = tid;
    await repo.save(v);
    res.json(v.toDict());
  } catch (error) {
    console.error("Error assigning office visit:", error);
    res.status(500).json({ error: "Failed to assign visit" });
  }
});

export default router;
