import express from "express";
import { AppDataSource } from "../data-source";
import { Customer } from "../entities/Customer";
import { Equipment } from "../entities/Equipment";
import { Visit } from "../entities/Visit";
import { ServiceLog } from "../entities/ServiceLog";
import { In } from "typeorm";
import { ServiceReport } from "../entities/ServiceReport";
import { requireJwt, requireAdmin, requireAuthenticated } from "./auth";
import { CustomerCreateSchema, CustomerUpdateSchema } from "../utils/validation";

const router = express.Router();

// GET /api/customers
router.get("/", requireAuthenticated, async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const { sort, include, has_coords, q, city, bydel } = req.query as any;

    let query = customerRepository.createQueryBuilder("customer");
    // Default til aktive kunder om ikke eksplisitt bedt om noe annet via include
    if (include !== "all") {
      query = query.where("customer.active = 1");
    }

    if (has_coords === "1" || has_coords === "true") {
      query = query.where("customer.latitude IS NOT NULL AND customer.longitude IS NOT NULL");
    }

    // Simple filters
    const search = (q ?? "").toString().trim();
    if (search) {
      query = query.andWhere("(customer.name LIKE :q OR customer.address LIKE :q)", { q: `%${search}%` });
    }
    const cityFilter = (city ?? bydel ?? "").toString().trim();
    if (cityFilter) {
      query = query.andWhere("customer.city LIKE :city", { city: `%${cityFilter}%` });
    }

    const customers = await query.getMany();

    if (include === "next_visit" || sort === "next_visit") {
      const customerIds = customers.map(c => c.id);
      const visitRepository = AppDataSource.getRepository(Visit);
      // Find upcoming visits (>= today) per customer
      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      let nextByCustomer = new Map<number, Date>();
      let lastByCustomer = new Map<number, Date>();
      if (customerIds.length) {
        const upcoming = await visitRepository
          .createQueryBuilder('visit')
          .where('visit.customerId IN (:...ids)', { ids: customerIds })
          .andWhere('visit.visitDate >= :since', { since })
          .orderBy('visit.visitDate', 'ASC')
          .getMany();
        for (const v of upcoming) {
          if (!nextByCustomer.has(v.customerId)) nextByCustomer.set(v.customerId, v.visitDate);
        }

        // Last visit/completed per customer
        const lastRaw = await visitRepository
          .createQueryBuilder('visit')
          .select('visit.customer_id', 'customer_id')
          .addSelect('MAX(visit.completed_at)', 'last_completed_at')
          .addSelect('MAX(visit.visit_date)', 'last_visit_date')
          .where('visit.customer_id IN (:...ids)', { ids: customerIds })
          .groupBy('visit.customer_id')
          .getRawMany();
        for (const row of lastRaw as any[]) {
          const cid = Number(row.customer_id);
          const lc = row.last_completed_at ? new Date(row.last_completed_at) : undefined;
          const lv = row.last_visit_date ? new Date(row.last_visit_date) : undefined;
          const base = lc || lv;
          if (cid && base) lastByCustomer.set(cid, base);
        }
      }

      const result = customers.map(customer => {
        const obj: any = customer.toDict();
        // Compute expected date from last visit + visitsPerYear
        const last = lastByCustomer.get(customer.id) || null;
        const vpyRaw = Number(customer.visitsPerYear || 0);
        const vpy = vpyRaw > 0 ? vpyRaw : 4; // fallback standard: 4 besøk per år
        let expected: Date | null = null;
        if (last && vpy > 0) {
          const days = Math.max(1, Math.round(365 / vpy));
          expected = new Date(last.getTime() + days * 24 * 60 * 60 * 1000);
        }
        obj.expected_service_date = expected ? expected.toISOString() : null;

        // Planned upcoming visit (if any)
        const planned = nextByCustomer.get(customer.id) || null;
        obj.planned_next_visit_date = planned ? planned.toISOString() : null;

        // Priority next_visit_date: planned upcoming else estimated expected
        obj.next_visit_date = planned ? planned.toISOString() : (expected ? expected.toISOString() : null);

        // Status based on expected date (same as map)
        let status: "green" | "yellow" | "red" = "red";
        if (expected) {
          const now = new Date();
          const diffDays = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          status = diffDays <= 30 ? (diffDays >= 0 ? "yellow" : "red") : "green";
        }
        obj.status = status;
        return obj;
      });

      if (sort === "next_visit") {
        result.sort((a, b) => {
          if (a.next_visit_date === null && b.next_visit_date === null) return 0;
          if (a.next_visit_date === null) return 1;
          if (b.next_visit_date === null) return -1;
          return new Date(a.next_visit_date).getTime() - new Date(b.next_visit_date).getTime();
        });
      }

      return res.json(result);
    }

    res.json(customers.map(c => c.toDict()));
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /api/customers/inactive - list inaktive kunder (admin)
router.get("/inactive", requireJwt, requireAdmin(), async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(Customer);
    const customers = await repo.find({ where: { active: false } as any, order: { name: "ASC" } });
    res.json(customers.map(c => c.toDict()));
  } catch (error) {
    console.error("Error fetching inactive customers:", error);
    res.status(500).json({ error: "Failed to fetch inactive customers" });
  }
});

// GET /api/map/customers
router.get("/customers", requireAuthenticated, async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const visitRepository = AppDataSource.getRepository(Visit);
    
    // Prefer active customers; fallback to all if the `active` column is missing on restored DBs
    let customers: Customer[] = [] as any;
    try {
      customers = await customerRepository.find({ where: { active: true } as any });
    } catch (err: any) {
      console.error('Error filtering active customers, falling back to all customers:', err?.message || err);
      // If the error is because the column doesn't exist, return all customers to avoid total failure
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        customers = await customerRepository.find();
      } else {
        throw err;
      }
    }
    const result = [];

    // Precompute next upcoming visits for all customers to avoid N+1
    const customerIds = customers.map(c => c.id);
    let nextByCustomer = new Map<number, Date>();
    let lastByCustomer = new Map<number, Date>();
    if (customerIds.length) {
      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000); // include today with a small grace
      const upcoming = await visitRepository
        .createQueryBuilder("visit")
        .where("visit.customerId IN (:...ids)", { ids: customerIds })
        .andWhere("visit.visitDate >= :since", { since })
        .orderBy("visit.visitDate", "ASC")
        .getMany();

      for (const v of upcoming) {
        if (!nextByCustomer.has(v.customerId)) {
          nextByCustomer.set(v.customerId, v.visitDate);
        }
      }

      // Last completed/visited date per customer for expected service calculation
      const lastRaw = await visitRepository
        .createQueryBuilder("visit")
        .select("visit.customer_id", "customer_id")
        .addSelect("MAX(visit.completed_at)", "last_completed_at")
        .addSelect("MAX(visit.visit_date)", "last_visit_date")
        .where("visit.customer_id IN (:...ids)", { ids: customerIds })
        .groupBy("visit.customer_id")
        .getRawMany();
      for (const row of lastRaw as any[]) {
        const cid = Number(row.customer_id);
        const lc = row.last_completed_at ? new Date(row.last_completed_at) : undefined;
        const lv = row.last_visit_date ? new Date(row.last_visit_date) : undefined;
        const base = lc || lv;
        if (cid && base) lastByCustomer.set(cid, base);
      }
    }

    for (const customer of customers) {
      let lat = customer.latitude;
      let lng = customer.longitude;

      // If no coordinates, derive from equipment centroid
      if (!lat || !lng) {
        const equipment = await equipmentRepository.find({
          where: { customerId: customer.id },
          select: ["latitude", "longitude"]
        });
        
        const validCoords = equipment.filter(e => e.latitude && e.longitude);
        if (validCoords.length > 0) {
          lat = validCoords.reduce((sum, e) => sum + (e.latitude || 0), 0) / validCoords.length;
          lng = validCoords.reduce((sum, e) => sum + (e.longitude || 0), 0) / validCoords.length;
        }
      }

      if (lat && lng) {
        const obj: any = customer.toDict();
        obj.latitude = lat;
        obj.longitude = lng;

        // Compute expected service date from last visit and visits_per_year
  const last = lastByCustomer.get(customer.id) || null;
  const vpyRaw = Number(customer.visitsPerYear || 0);
  const vpy = vpyRaw > 0 ? vpyRaw : 4; // fallback standard: 4 besøk per år
        let expected: Date | null = null;
        if (last && vpy > 0) {
          const days = Math.max(1, Math.round(365 / vpy));
          expected = new Date(last.getTime() + days * 24 * 60 * 60 * 1000);
        }
        obj.expected_service_date = expected ? expected.toISOString() : null;

        // Keep planned visit info separately for UI
        const planned = nextByCustomer.get(customer.id) || null;
        obj.planned_next_visit_date = planned ? planned.toISOString() : null;

        // Status based on expected service date
        let status: "green" | "yellow" | "red" = "red";
        if (expected) {
          const now = new Date();
          const diffDays = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          status = diffDays <= 30 ? (diffDays >= 0 ? "yellow" : "red") : "green";
        }
        obj.status = status;

        result.push(obj);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching map customers:", error);
    res.status(500).json({ error: "Failed to fetch map customers" });
  }
});

// POST /api/customers
router.post("/", requireAuthenticated, async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const parsed = CustomerCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Ugyldig input",
        errors: parsed.error.issues?.map(i => ({ path: i.path?.join('.') || '', message: i.message })) || [],
      });
    }
    const { name, address, postal_code, city, contact_person, email, phone, org_number } = parsed.data;

    const customer = new Customer();
    customer.name = name;
    customer.address = address;
    customer.postalCode = postal_code;
    customer.city = city;
    customer.contactPerson = contact_person;
    customer.email = email;
    customer.phone = phone;
    customer.orgNumber = org_number;
    customer.active = true;

    await customerRepository.save(customer);
    res.status(201).json(customer.toDict());
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// GET /api/customers/:id
router.get("/:id", requireAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer.toDict());
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// PUT /api/customers/:id
router.put("/:id", requireAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const parsed = CustomerUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Ugyldig input",
        errors: parsed.error.issues?.map(i => ({ path: i.path?.join('.') || '', message: i.message })) || [],
      });
    }
    const { name, address, postal_code, city, contact_person, email, phone, org_number, visits_per_year, start_date, latitude, longitude, active } = parsed.data;

    if (name !== undefined) customer.name = name;
    if (address !== undefined) customer.address = address;
    if (postal_code !== undefined) customer.postalCode = postal_code;
    if (city !== undefined) customer.city = city;
    if (contact_person !== undefined) customer.contactPerson = contact_person;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (org_number !== undefined) customer.orgNumber = org_number;
    if (visits_per_year !== undefined) customer.visitsPerYear = visits_per_year as unknown as number;
    if (start_date !== undefined) customer.startDate = start_date ? new Date(start_date as string) : undefined;
    if (latitude !== undefined) customer.latitude = latitude as unknown as number;
    if (longitude !== undefined) customer.longitude = longitude as unknown as number;
    if (active !== undefined) customer.active = !!active;

    await customerRepository.save(customer);
    res.json(customer.toDict());
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// DELETE /api/customers/:id -> soft delete (set active = false). Falls back to hard delete if DB lacks the column.
router.delete("/:id", requireAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // Try soft-delete by flipping active -> false
    try {
      // Some restored DBs may be missing the `active` column; this will throw in that case
      // Keep the change in DB and return the updated object
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      customer.active = false;
      await customerRepository.save(customer);
      return res.json({ message: "Customer deactivated", customer: customer.toDict() });
    } catch (innerErr: any) {
      console.error("Soft-delete failed, attempting fallback hard delete:", innerErr);
      // If the error is due to missing column (e.g. ER_BAD_FIELD_ERROR), fallback to hard delete
      if (innerErr && (innerErr.code === 'ER_BAD_FIELD_ERROR' || innerErr.code === 'ER_TRUNCATED_WRONG_VALUE')) {
        const result = await customerRepository.delete(id);
        if (result.affected === 0) return res.status(404).json({ error: "Customer not found" });
        return res.json({ message: "Customer deleted (fallback)" });
      }
      // Otherwise rethrow to be handled by outer catch
      throw innerErr;
    }
  } catch (error) {
    console.error("Error deleting/deactivating customer:", error);
    res.status(500).json({ error: "Failed to delete/deactivate customer" });
  }
});

// GET /api/customers/:id/detail
router.get("/:id/detail", requireAuthenticated, async (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(customerId)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const customerRepository = AppDataSource.getRepository(Customer);
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const visitRepository = AppDataSource.getRepository(Visit);
    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
  const reportRepo = AppDataSource.getRepository(ServiceReport);

    const customer = await customerRepository.findOne({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const equipment = await equipmentRepository.find({
      where: { customerId },
      order: { name: "ASC" }
    });

    const visits = await visitRepository.find({
      where: { customerId },
      order: { visitDate: "DESC" }
    });

    const serviceLogs = await serviceLogRepository
      .createQueryBuilder("log")
      .innerJoin("log.visit", "visit")
      .leftJoin("log.equipmentItem", "equipment")
      .where("visit.customerId = :customerId", { customerId })
      .orderBy("log.logDate", "DESC")
      .getMany();

  // Build response
  const customerObj: any = customer.toDict();
  // Compute next visit for this customer: prefer upcoming planned visit, else estimate from last visit
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const upcoming = await visitRepository
      .createQueryBuilder('visit')
      .where('visit.customerId = :id', { id: customerId })
      .andWhere('visit.visitDate >= :since', { since })
      .orderBy('visit.visitDate', 'ASC')
      .getOne();
    if (upcoming && upcoming.visitDate) {
      customerObj.next_visit_date = upcoming.visitDate.toISOString();
    } else {
      // find last visit/completed
      const lastRaw = await visitRepository
        .createQueryBuilder('visit')
        .select('MAX(visit.completed_at)', 'last_completed_at')
        .addSelect('MAX(visit.visit_date)', 'last_visit_date')
        .where('visit.customer_id = :id', { id: customerId })
        .getRawOne();
      const lc = lastRaw?.last_completed_at ? new Date(lastRaw.last_completed_at) : undefined;
      const lv = lastRaw?.last_visit_date ? new Date(lastRaw.last_visit_date) : undefined;
      const base = lc || lv || null;
  const vpyRaw = Number(customer.visitsPerYear || 0);
  const vpy = vpyRaw > 0 ? vpyRaw : 4; // fallback: 4 besøk/år om ikke satt
  if (base && vpy > 0) {
        const days = Math.max(1, Math.round(365 / vpy));
        const expected = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        customerObj.next_visit_date = expected.toISOString();
      } else {
        customerObj.next_visit_date = null;
      }
    }

    const logs = serviceLogs.map(log => {
      const obj = log.toDict();
      // TODO: Add visit date and equipment name
      return obj;
    });

    const reports = await reportRepo.find({ where: { customerId }, order: { createdAt: "DESC" } as any });

    res.json({
      customer: customerObj,
      equipment: equipment.map(e => e.toDict()),
      visits: visits.map(v => v.toDict()),
      logs,
      reports: reports.map(r => r.toDict()),
    });
  } catch (error) {
    console.error("Error fetching customer detail:", error);
    res.status(500).json({ error: "Failed to fetch customer detail" });
  }
});

// PUT /api/customers/:id/deactivate
router.put("/:id/deactivate", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const repo = AppDataSource.getRepository(Customer);
    const customer = await repo.findOne({ where: { id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    customer.active = false;
    await repo.save(customer);
    res.json(customer.toDict());
  } catch (error) {
    console.error("Error deactivating customer:", error);
    res.status(500).json({ error: "Failed to deactivate customer" });
  }
});

// PUT /api/customers/:id/reactivate
router.put("/:id/reactivate", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be an integer" });
    const repo = AppDataSource.getRepository(Customer);
    const customer = await repo.findOne({ where: { id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    customer.active = true;
    await repo.save(customer);
    res.json(customer.toDict());
  } catch (error) {
    console.error("Error reactivating customer:", error);
    res.status(500).json({ error: "Failed to reactivate customer" });
  }
});

// POST /api/customers/:id/fix-geo
router.post("/:id/fix-geo", requireAuthenticated, async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const customer = await customerRepository.findOne({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "latitude/longitude must be numbers" });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "latitude/longitude out of range" });
    }

    customer.latitude = lat;
    customer.longitude = lng;

    await customerRepository.save(customer);
    res.json(customer.toDict());
  } catch (error) {
    console.error("Error fixing customer coordinates:", error);
    res.status(500).json({ error: "Failed to update coordinates" });
  }
});

export default router;
