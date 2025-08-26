import express from "express";
import { AppDataSource } from "../data-source";
import { Equipment } from "../entities/Equipment";
import { EquipmentType } from "../entities/EquipmentType";
import { Visit } from "../entities/Visit";

const router = express.Router();

// GET /api/equipment
router.get("/", async (req, res) => {
  try {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const { customer_id } = req.query;

    let query = equipmentRepository.createQueryBuilder("equipment")
      .leftJoinAndSelect("equipment.equipmentType", "equipmentType");

    if (customer_id !== undefined) {
      const cid = parseInt(customer_id as string, 10);
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
    const { name, customer_id, equipment_type_id, latitude, longitude } = req.body;

    if (!name || !customer_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const equipment = new Equipment();
    equipment.name = name;
    equipment.customerId = customer_id;
    equipment.equipmentTypeId = equipment_type_id;
    equipment.latitude = latitude;
    equipment.longitude = longitude;

    await equipmentRepository.save(equipment);
    res.status(201).json(equipment.toDict());
  } catch (error) {
    res.status(500).json({ error: "Failed to create equipment" });
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

    const { name, equipment_type_id, latitude, longitude, properties } = req.body;

    if (name !== undefined) equipment.name = name;
    if (equipment_type_id !== undefined) equipment.equipmentTypeId = equipment_type_id;
    if (latitude !== undefined) equipment.latitude = latitude;
    if (longitude !== undefined) equipment.longitude = longitude;
    if (properties !== undefined) equipment.properties = properties;

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
