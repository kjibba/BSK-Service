import express from "express";
import path from "path";
import fs from "fs";
import { AppDataSource } from "../data-source";
import { Equipment } from "../entities/Equipment";
import { EquipmentType } from "../entities/EquipmentType";
import { Visit } from "../entities/Visit";
import { Customer } from "../entities/Customer";
import { requireJwt, requireAdmin } from "./auth";

const router = express.Router();

function parseDateOnly(value: any): Date | undefined {
  if (!value) return undefined;
  try {
    if (value instanceof Date) return value;
    let s = String(value);
    // Accept ISO with time; take date part
    if (s.includes("T")) s = s.split("T")[0];
    // YYYY-MM-DD
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return undefined;
    return new Date(Date.UTC(y, m - 1, d));
  } catch {
    return undefined;
  }
}

function ensureUploadsDir(): string {
  // __dirname at runtime -> dist/routes; go two levels up to project root of backend-nodejs, then static/uploads
  const dir = path.join(__dirname, "../../static/uploads");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function saveDataUrlImage(dataUrl: string): string | undefined {
  try {
    if (!dataUrl.startsWith("data:")) return undefined;
    const [header, b64] = dataUrl.split(",", 2);
    const mime = header.split(";")[0].replace("data:", "");
    if (!mime.startsWith("image/")) return undefined;
    const decoded = Buffer.from(b64, "base64");
    const MAX = 2_500_000; // ~2.5MB
    if (decoded.length > MAX) return undefined;
    let ext = "jpg";
    if (mime.includes("png")) ext = "png";
    else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
    else if (mime.includes("gif")) ext = "gif";
    const dir = ensureUploadsDir();
    const fname = `placement_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const fpath = path.join(dir, fname);
    fs.writeFileSync(fpath, decoded);
    return `/static/uploads/${fname}`;
  } catch {
    return undefined;
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/equipment
router.get("/", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const { customer_id, customerId } = req.query as any;

    let query = equipmentRepository.createQueryBuilder("equipment")
      .leftJoinAndSelect("equipment.equipmentType", "equipmentType");

    const rawCid = customer_id ?? customerId;
    if (rawCid !== undefined) {
      const cid = parseInt(String(rawCid), 10);
      if (!Number.isInteger(cid)) {
        return res.status(400).json({ error: "customer_id must be an integer" });
      }
      query = query.where("equipment.customerId = :customerId", { 
        customerId: cid 
      });
    }

    const equipment = await query.getMany();
    res.json(equipment.map(e => e.toDict()));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

// POST /api/equipment
router.post("/", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const { name, customer_id, equipment_type_id, latitude, longitude, type, serial_number, installed_at, notes, properties, placement_photo } = req.body || {};

    if (!name || !customer_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const equipment = new Equipment();
    equipment.name = name;
    equipment.customerId = customer_id;
    equipment.equipmentTypeId = equipment_type_id;
    equipment.latitude = latitude;
    equipment.longitude = longitude;
    if (type !== undefined) equipment.type = type;
    if (serial_number !== undefined) equipment.serialNumber = serial_number;
    if (installed_at !== undefined) equipment.installedAt = parseDateOnly(installed_at);
    if (notes !== undefined) equipment.notes = notes;
    if (properties !== undefined) equipment.properties = properties;
    if (placement_photo && typeof placement_photo === "string" && placement_photo.startsWith("data:")) {
      const url = saveDataUrlImage(placement_photo);
      if (!url) return res.status(400).json({ error: "Failed to process uploaded image" });
      const props = { ...(equipment.properties || {}) } as any;
      props.placement_photo_url = url;
      equipment.properties = props;
    }

    await equipmentRepository.save(equipment);
    res.status(201).json(equipment.toDict());
  } catch (error) {
    res.status(500).json({ error: "Failed to create equipment" });
  }
});

// GET /api/equipment/:id
router.get("/:id", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const equipment = await equipmentRepository.findOne({ where: { id } });
    if (!equipment) return res.status(404).json({ error: "Equipment not found" });
    res.json(equipment.toDict());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

// PUT /api/equipment/:id
router.put("/:id", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const equipment = await equipmentRepository.findOne({
      where: { id }
    });

    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    const { name, equipment_type_id, latitude, longitude, properties, type, serial_number, installed_at, notes, customer_id, placement_photo } = req.body || {};

    if (name !== undefined) equipment.name = name;
    if (equipment_type_id !== undefined) equipment.equipmentTypeId = equipment_type_id;
    if (latitude !== undefined) equipment.latitude = latitude;
    if (longitude !== undefined) equipment.longitude = longitude;
    if (type !== undefined) equipment.type = type;
    if (serial_number !== undefined) equipment.serialNumber = serial_number;
    if (installed_at !== undefined) equipment.installedAt = parseDateOnly(installed_at) ?? equipment.installedAt;
    if (notes !== undefined) equipment.notes = notes;
    if (customer_id !== undefined && Number.isInteger(Number(customer_id))) equipment.customerId = Number(customer_id);
    if (properties !== undefined) {
      try {
        const merged = { ...(equipment.properties || {}) } as any;
        Object.assign(merged, properties || {});
        equipment.properties = merged;
      } catch {
        equipment.properties = properties;
      }
    }
    if (placement_photo && typeof placement_photo === "string" && placement_photo.startsWith("data:")) {
      const url = saveDataUrlImage(placement_photo);
      if (url) {
        const props = { ...(equipment.properties || {}) } as any;
        props.placement_photo_url = url;
        equipment.properties = props;
      }
    }

    await equipmentRepository.save(equipment);
    res.json(equipment.toDict());
  } catch (error) {
    res.status(500).json({ error: "Failed to update equipment" });
  }
});

// DELETE /api/equipment/:id
router.delete("/:id", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const result = await equipmentRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    res.json({ message: "Equipment deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete equipment" });
  }
});

export default router;

// POST /api/equipment/:id/assign_nearest
// Body: { latitude?, longitude?, max_distance_m?, force?, dry_run? }
// Behavior: finds nearest active customer with coords to given (lat,lng) (from body or equipment),
// and assigns equipment.customerId to that customer's id if within threshold. If dry_run, no update.
router.post("/:id/assign_nearest", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const customerRepository = AppDataSource.getRepository(Customer);

    const equipment = await equipmentRepository.findOne({ where: { id } });
    if (!equipment) return res.status(404).json({ error: "Equipment not found" });

    const { latitude, longitude, max_distance_m, force, dry_run } = req.body || {};
    const lat = latitude !== undefined ? Number(latitude) : equipment.latitude;
    const lng = longitude !== undefined ? Number(longitude) : equipment.longitude;
    if (!Number.isFinite(lat as number) || !Number.isFinite(lng as number)) {
      return res.status(400).json({ error: "latitude/longitude required on equipment or in request body" });
    }
    const threshold = Number.isFinite(Number(max_distance_m)) ? Number(max_distance_m) : 250; // meters
    const isDryRun = !!dry_run;
    const doForce = !!force;

    // Fetch candidate customers with coords (prefer active)
    const customers = await customerRepository.createQueryBuilder("c")
      .where("c.latitude IS NOT NULL AND c.longitude IS NOT NULL")
      .andWhere("c.active = 1")
      .getMany();
    if (!customers.length) {
      return res.status(404).json({ error: "No customers with coordinates available" });
    }

    let best: { customer: Customer, distance: number } | null = null;
    for (const c of customers) {
      const d = haversineMeters(lat as number, lng as number, c.latitude as number, c.longitude as number);
      if (!best || d < best.distance) best = { customer: c, distance: d };
    }

    if (!best) return res.status(404).json({ error: "No nearby customer found" });

    const within = best.distance <= threshold;
    if (isDryRun) {
      return res.json({
        equipment_id: equipment.id,
        current_customer_id: equipment.customerId,
        nearest_customer_id: best.customer.id,
        nearest_customer_name: best.customer.name,
        distance_meters: Math.round(best.distance),
        within_threshold: within,
        threshold_meters: threshold,
      });
    }

    if (!within) {
      return res.status(422).json({ error: "Nearest customer is outside threshold", distance_meters: Math.round(best.distance), threshold_meters: threshold, nearest_customer_id: best.customer.id });
    }

    const prev = equipment.customerId;
    if (!doForce && prev === best.customer.id) {
      return res.json({
        equipment_id: equipment.id,
        assigned_customer_id: prev,
        distance_meters: Math.round(best.distance),
        changed: false,
      });
    }

    equipment.customerId = best.customer.id;
    await equipmentRepository.save(equipment);
    return res.json({
      equipment_id: equipment.id,
      assigned_customer_id: equipment.customerId,
      previous_customer_id: prev,
      distance_meters: Math.round(best.distance),
      changed: prev !== equipment.customerId,
    });
  } catch (error) {
    console.error("assign_nearest error:", error);
    res.status(500).json({ error: "Failed to assign nearest customer" });
  }
});

// POST /api/equipment/assign_nearest/batch
// Body: { max_distance_m?, dry_run?, limit? }
// For alle utstyr med koordinater, finn nærmeste aktive kunde og tilordne hvis innen terskel.
router.post("/assign_nearest/batch", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const { max_distance_m, dry_run, limit } = req.body || {};
    const threshold = Number.isFinite(Number(max_distance_m)) ? Number(max_distance_m) : 250;
    const isDry = !!dry_run;
    const lim = Number.isFinite(Number(limit)) ? Number(limit) : undefined;

    const eqRepo = AppDataSource.getRepository(Equipment);
    const custRepo = AppDataSource.getRepository(Customer);
    const equipment = await eqRepo.createQueryBuilder("e")
      .where("e.latitude IS NOT NULL AND e.longitude IS NOT NULL")
      .getMany();
    const customers = await custRepo.createQueryBuilder("c")
      .where("c.latitude IS NOT NULL AND c.longitude IS NOT NULL")
      .andWhere("c.active = 1")
      .getMany();
    if (!customers.length) return res.status(404).json({ error: "No customers with coordinates" });

    const results: any[] = [];
    let changed = 0; let processed = 0;
    for (const e of equipment) {
      const lat = e.latitude as number; const lng = e.longitude as number;
      let best: { id: number, name: string, distance: number } | null = null;
      for (const c of customers) {
        const d = haversineMeters(lat, lng, c.latitude as number, c.longitude as number);
        if (!best || d < best.distance) best = { id: c.id, name: c.name, distance: d };
      }
      if (!best) continue;
      const within = best.distance <= threshold;
      if (within && best.id !== e.customerId) {
        processed += 1;
        results.push({ equipment_id: e.id, from_customer_id: e.customerId, to_customer_id: best.id, to_customer_name: best.name, distance_meters: Math.round(best.distance) });
        if (!isDry) {
          e.customerId = best.id;
        }
        changed += 1;
        if (!isDry && lim && changed >= lim) break;
      }
    }
    if (!isDry) await eqRepo.save(equipment.filter(x => results.some(r => r.equipment_id === x.id)));
    res.json({ threshold_meters: threshold, dry_run: isDry, changed_count: isDry ? results.length : changed, items: results });
  } catch (error) {
    console.error("batch assign_nearest error:", error);
    res.status(500).json({ error: "Failed batch assign" });
  }
});

// POST /api/equipment/assign_to_customer_by_coords
// Body: { target_customer_id: number, max_distance_m?, dry_run? }
// Tilordner alle utstyr innenfor terskel til oppgitt kunde (basert på kundens posisjon).
router.post("/assign_to_customer_by_coords", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const { target_customer_id, max_distance_m, dry_run } = req.body || {};
    const targetId = Number(target_customer_id);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: "target_customer_id must be integer" });
    const threshold = Number.isFinite(Number(max_distance_m)) ? Number(max_distance_m) : 250;
    const isDry = !!dry_run;

    const custRepo = AppDataSource.getRepository(Customer);
    const eqRepo = AppDataSource.getRepository(Equipment);
    const target = await custRepo.findOne({ where: { id: targetId } });
    if (!target || target.latitude == null || target.longitude == null) return res.status(400).json({ error: "Target customer missing coordinates" });

    const equipment = await eqRepo.createQueryBuilder("e")
      .where("e.latitude IS NOT NULL AND e.longitude IS NOT NULL")
      .getMany();

    const results: any[] = [];
    let changed = 0;
    for (const e of equipment) {
      const d = haversineMeters(e.latitude as number, e.longitude as number, target.latitude as number, target.longitude as number);
      if (d <= threshold && e.customerId !== targetId) {
        results.push({ equipment_id: e.id, from_customer_id: e.customerId, to_customer_id: targetId, distance_meters: Math.round(d) });
        if (!isDry) {
          e.customerId = targetId;
          changed += 1;
        }
      }
    }
    if (!isDry && changed > 0) await eqRepo.save(equipment.filter(x => results.some(r => r.equipment_id === x.id)));
    res.json({ target_customer_id: targetId, threshold_meters: threshold, dry_run: isDry, changed_count: isDry ? results.length : changed, items: results });
  } catch (error) {
    console.error("assign_to_customer_by_coords error:", error);
    res.status(500).json({ error: "Failed to assign to customer by coords" });
  }
});
