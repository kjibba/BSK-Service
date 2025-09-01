import express from "express";
import { AppDataSource } from "../data-source";
import { Visit } from "../entities/Visit";
import { Customer } from "../entities/Customer";
import { ServiceLog } from "../entities/ServiceLog";
import { Employee } from "../entities/Employee";
import { Equipment } from "../entities/Equipment";
import { MaterialUsage } from "../entities/MaterialUsage";
import { In } from "typeorm";
import { requireJwt, requireAdmin } from "./auth";
import { VisitCreateSchema, VisitUpdateSchema } from "../utils/validation";
import { saveDataUrlImage } from "../utils/uploads";
import path from "path";
import { sendMail } from "../utils/mailer";
import { generateServiceReportPdf } from "../utils/reportPdf";
import { ServiceReport } from "../entities/ServiceReport";

const router = express.Router();
// Separate router for office-specific listing to avoid '/:id' conflicts
export const officeVisitsRouter = express.Router();

// POST /api/visits/start_or_create_by_customer { customer_id }
router.post("/start_or_create_by_customer", async (req, res) => {
  try {
    const cid = Number((req.body as any)?.customer_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: "customer_id must be an integer" });
    const repo = AppDataSource.getRepository(Visit);
    // check existing ongoing
    const existing = await repo.createQueryBuilder("visit")
      .where("visit.customerId = :cid", { cid })
      .andWhere("visit.status = :s", { s: "Pågående" })
      .orderBy("visit.startedAt", "DESC")
      .getOne();
    if (existing) return res.json(existing.toDict());
    // else create planned visit dated now
    const v = new Visit();
    v.customerId = cid;
    v.visitDate = new Date();
    v.status = "Planlagt";
    await repo.save(v);
    res.status(201).json(v.toDict());
  } catch (error) {
    console.error("Error start_or_create_by_customer:", error);
    res.status(500).json({ error: "Failed to start or create visit" });
  }
});

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

// GET /api/visits/active?customer_id=...
router.get("/active", async (req, res) => {
  try {
    const cid = Number((req.query as any).customer_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: "customer_id must be an integer" });
    const repo = AppDataSource.getRepository(Visit);
    const v = await repo.createQueryBuilder("visit")
      .where("visit.customerId = :cid", { cid })
      .andWhere("visit.status = :s", { s: "Pågående" })
      .orderBy("visit.startedAt", "DESC")
      .getOne();
    if (!v) return res.status(404).json({ error: "No active visit" });
    res.json(v.toDict());
  } catch (error) {
    console.error("Error fetching active visit:", error);
    res.status(500).json({ error: "Failed to fetch active visit" });
  }
});

// GET /api/visits/report?startDate=...&endDate=...&technician=...
router.get("/report", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const { startDate, endDate, technician } = req.query as any;
    const repo = AppDataSource.getRepository(Visit);
    let qb = repo.createQueryBuilder("visit").leftJoinAndSelect("visit.customer", "customer");
    if (startDate) qb = qb.andWhere("visit.visitDate >= :sd", { sd: new Date(String(startDate)) });
    if (endDate) qb = qb.andWhere("visit.visitDate <= :ed", { ed: new Date(String(endDate)) });
    if (technician) qb = qb.andWhere("visit.technician = :t", { t: String(technician) });
    const items = await qb.orderBy("visit.visitDate", "DESC").getMany();
    res.json(items.map(v => v.toDict()));
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// POST /api/visits
router.post("/", async (req, res) => {
  try {
    const visitRepository = AppDataSource.getRepository(Visit);
    const parsed = VisitCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Ugyldig input",
        errors: parsed.error.issues?.map(i => ({ path: i.path?.join('.') || '', message: i.message })) || [],
      });
    }
    const { customer_id, visit_date, technician, notes, status, assigned_technician_id, customer_signature_url, technician_signature_url } = parsed.data;

    const visit = new Visit();
    visit.customerId = customer_id as unknown as number;
    visit.visitDate = new Date(String(visit_date));
    visit.technician = technician as any;
    visit.notes = notes as any;
    visit.status = (status as any) || "Planlagt";
    if (assigned_technician_id !== undefined) {
      const tid = Number(assigned_technician_id);
      if (!Number.isNaN(tid)) visit.assignedTechnicianId = tid;
    }
    // Support data URL uploads for signature images
    if (customer_signature_url !== undefined) {
      const url = (String(customer_signature_url).startsWith('data:') ? saveDataUrlImage(String(customer_signature_url)) : undefined) || (customer_signature_url as any);
      visit.customerSignatureUrl = url as any;
    }
    if (technician_signature_url !== undefined) {
      const url = (String(technician_signature_url).startsWith('data:') ? saveDataUrlImage(String(technician_signature_url)) : undefined) || (technician_signature_url as any);
      visit.technicianSignatureUrl = url as any;
    }

    await visitRepository.save(visit);
    res.status(201).json(visit.toDict());
  } catch (error) {
    console.error("Error creating visit:", error);
    res.status(500).json({ error: "Failed to create visit" });
  }
});

// POST /api/office/visits - create visit from office
officeVisitsRouter.post("/", requireJwt, requireAdmin(), async (req, res) => {
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

    // Also include all equipment for the customer so VisitDetail can show map/list
    const custEquip = await equipRepo.find({ where: { customerId: visit.customerId }, relations: ["equipmentType"] });
    const equipObjs = custEquip.map(e => ({
      ...e.toDict(),
      equipment_type_name: (e as any).equipmentType?.name || undefined,
    }));

    res.json({ visit: visit.toDict(), customer: visit.customer?.toDict?.() || undefined, logs: logObjs, equipment: equipObjs });
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

    // Build PDF data from visit, customer and logs
    try {
      const custRepo = AppDataSource.getRepository(Customer);
      const logRepo = AppDataSource.getRepository(ServiceLog);
      const equipRepo = AppDataSource.getRepository(Equipment);
      const customer = await custRepo.findOne({ where: { id: visit.customerId } });
      const logs = await logRepo.find({ where: { visitId: visit.id }, order: { logDate: "ASC" } });
      const eqIds = Array.from(new Set(logs.map(l => l.equipmentId))).filter(Boolean) as number[];
      const names = new Map<number, string>();
      if (eqIds.length) {
        const list = await equipRepo.find({ where: { id: In(eqIds) } });
        list.forEach(e => names.set(e.id, e.name || "Utstyr"));
      }
      const reportData = {
        customer: {
          id: customer?.id || 0,
          name: customer?.name,
          address: customer?.address,
          postal_code: customer?.postalCode,
          city: customer?.city,
          email: customer?.email,
        },
        visit: {
          id: visit.id,
          visit_date: visit.visitDate ? visit.visitDate.toISOString() : undefined,
          started_at: visit.startedAt ? visit.startedAt.toISOString() : null,
          completed_at: visit.completedAt ? visit.completedAt.toISOString() : null,
          technician: visit.technician || null,
          notes: visit.notes || null,
          oppsummering_notat: visit.oppsummeringNotat || null,
        },
        logs: logs.map(l => ({
          id: l.id,
          log_date: l.logDate ? l.logDate.toISOString() : undefined,
          description: l.description || "",
          hours_worked: l.hoursWorked || undefined,
          equipment_name: names.get(l.equipmentId) || null,
        })),
      };

      const outDir = path.join(__dirname, "../static/reports");
      const { filePath, absPath } = await generateServiceReportPdf(reportData as any, outDir);

      // Save report row
      const repRepo = AppDataSource.getRepository(ServiceReport);
      const sr = new ServiceReport();
      sr.visitId = visit.id;
      sr.customerId = visit.customerId;
      sr.filePath = filePath.startsWith('/static') ? filePath : `/static/${filePath}`.replace(/\\/g,'/');
      await repRepo.save(sr);

      // Send email with attachment to fixed recipient for now
      const to = "kjibba@gmail.com";
      const subj = `Servicerapport ${customer?.name || ''} — Besøk #${visit.id}`.trim();
      const html = `<p>Hei,</p><p>Vedlagt servicerapport for kunde <strong>${customer?.name || ''}</strong> (besøk #${visit.id}).</p><p>Mvh,<br/>BSK Service App</p>`;
      try {
        await sendMail({
          to,
          subject: subj,
          html,
          attachments: [ { filename: `servicerapport_${visit.id}.pdf`, path: absPath, contentType: 'application/pdf' } ],
        });
      } catch (mailErr) {
        console.error('Epost-feil:', mailErr);
      }
    } catch (genErr) {
      console.error('Feil ved generering/sending av rapport:', genErr);
      // Continue; completion should not fail due to report/email issues
    }

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

    const parsed = VisitUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Ugyldig input",
        errors: parsed.error.issues?.map(i => ({ path: i.path?.join('.') || '', message: i.message })) || [],
      });
    }
    const { visit_date, technician, notes, status, started_at, completed_at, customer_signature_url, technician_signature_url } = parsed.data;

    if (visit_date !== undefined) visit.visitDate = new Date(String(visit_date));
    if (technician !== undefined) visit.technician = technician as any;
    if (notes !== undefined) visit.notes = notes as any;
    if (status !== undefined) visit.status = status as any;
    if (started_at !== undefined) visit.startedAt = started_at ? new Date(String(started_at)) : undefined;
    if (completed_at !== undefined) visit.completedAt = completed_at ? new Date(String(completed_at)) : undefined;
    if (customer_signature_url !== undefined) {
      const url = (String(customer_signature_url).startsWith('data:') ? saveDataUrlImage(String(customer_signature_url)) : undefined) || (customer_signature_url as any);
      visit.customerSignatureUrl = url as any;
    }
    if (technician_signature_url !== undefined) {
      const url = (String(technician_signature_url).startsWith('data:') ? saveDataUrlImage(String(technician_signature_url)) : undefined) || (technician_signature_url as any);
      visit.technicianSignatureUrl = url as any;
    }

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
router.post("/batch_delete", requireJwt, requireAdmin(), async (req, res) => {
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
officeVisitsRouter.get("/", requireJwt, requireAdmin(), async (req, res) => {
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
officeVisitsRouter.post("/:id/assign", requireJwt, requireAdmin(), async (req, res) => {
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
