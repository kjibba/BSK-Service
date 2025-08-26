import express from "express";
import { AppDataSource } from "../data-source";
import { ServiceLog } from "../entities/ServiceLog";
import { Equipment } from "../entities/Equipment";
import { Visit } from "../entities/Visit";

const router = express.Router();

// GET /api/service-logs
router.get("/", async (req, res) => {
  try {
    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
    const { equipment_id, visit_id } = req.query;

    let whereClause: any = {};
    
    if (equipment_id !== undefined) {
      const eid = parseInt(equipment_id as string, 10);
      if (!Number.isInteger(eid)) {
        return res.status(400).json({ error: "equipment_id must be an integer" });
      }
      whereClause.equipmentId = eid;
    }

    if (visit_id !== undefined) {
      const vid = parseInt(visit_id as string, 10);
      if (!Number.isInteger(vid)) {
        return res.status(400).json({ error: "visit_id must be an integer" });
      }
      whereClause.visitId = vid;
    }

    const serviceLogs = await serviceLogRepository.find({
      where: whereClause,
      relations: ["visit", "equipmentItem", "materialsUsed", "materialsUsed.material"],
      order: { logDate: "DESC" }
    });

    res.json(serviceLogs.map(log => log.toDict()));
  } catch (error) {
    console.error("Error fetching service logs:", error);
    res.status(500).json({ error: "Failed to fetch service logs" });
  }
});

// GET /api/service-logs/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
    const serviceLog = await serviceLogRepository.findOne({
      where: { id },
      relations: ["visit", "equipmentItem", "materialsUsed", "materialsUsed.material"]
    });

    if (!serviceLog) {
      return res.status(404).json({ error: "Service log not found" });
    }

    res.json(serviceLog.toDict());
  } catch (error) {
    console.error("Error fetching service log:", error);
    res.status(500).json({ error: "Failed to fetch service log" });
  }
});

// POST /api/service-logs
router.post("/", async (req, res) => {
  try {
    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const visitRepository = AppDataSource.getRepository(Visit);

    const { equipment_id, visit_id, log_date, description, hours_worked } = req.body;

    if (equipment_id === undefined || visit_id === undefined || !description) {
      return res.status(400).json({ error: "Equipment ID, visit ID, and description are required" });
    }

    const eid = parseInt(String(equipment_id), 10);
    const vid = parseInt(String(visit_id), 10);
    if (!Number.isInteger(eid) || !Number.isInteger(vid)) {
      return res.status(400).json({ error: "equipment_id and visit_id must be integers" });
    }

    // Verify equipment exists
    const equipment = await equipmentRepository.findOne({
      where: { id: eid }
    });
    if (!equipment) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    // Verify visit exists
    const visit = await visitRepository.findOne({
      where: { id: vid }
    });
    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }

    const serviceLog = new ServiceLog();
    serviceLog.equipmentId = eid;
    serviceLog.visitId = vid;
    serviceLog.logDate = log_date ? new Date(log_date) : new Date();
    serviceLog.description = description;
    serviceLog.hoursWorked = hours_worked;

    await serviceLogRepository.save(serviceLog);

    // Fetch the saved service log with relations
    const savedServiceLog = await serviceLogRepository.findOne({
      where: { id: serviceLog.id },
      relations: ["visit", "equipmentItem", "materialsUsed", "materialsUsed.material"]
    });

    res.status(201).json(savedServiceLog!.toDict());
  } catch (error) {
    console.error("Error creating service log:", error);
    res.status(500).json({ error: "Failed to create service log" });
  }
});

// PUT /api/service-logs/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
    const serviceLog = await serviceLogRepository.findOne({
      where: { id }
    });

    if (!serviceLog) {
      return res.status(404).json({ error: "Service log not found" });
    }

    const { log_date, description, hours_worked } = req.body;

    if (log_date !== undefined) serviceLog.logDate = new Date(log_date);
    if (description !== undefined) serviceLog.description = description;
    if (hours_worked !== undefined) serviceLog.hoursWorked = hours_worked;

    await serviceLogRepository.save(serviceLog);

    // Fetch the updated service log with all relations
    const updatedServiceLog = await serviceLogRepository.findOne({
      where: { id: serviceLog.id },
      relations: ["visit", "equipmentItem", "materialsUsed", "materialsUsed.material"]
    });

    res.json(updatedServiceLog!.toDict());
  } catch (error) {
    console.error("Error updating service log:", error);
    res.status(500).json({ error: "Failed to update service log" });
  }
});

// DELETE /api/service-logs/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const serviceLogRepository = AppDataSource.getRepository(ServiceLog);
    const result = await serviceLogRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Service log not found" });
    }

    res.json({ message: "Service log deleted successfully" });
  } catch (error) {
    console.error("Error deleting service log:", error);
    res.status(500).json({ error: "Failed to delete service log" });
  }
});

export default router;
