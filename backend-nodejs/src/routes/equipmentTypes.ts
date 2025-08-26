import express from "express";
import { AppDataSource } from "../data-source";
import { EquipmentType } from "../entities/EquipmentType";

const router = express.Router();

// GET /api/equipment-types
router.get("/", async (req, res) => {
  try {
    const equipmentTypeRepository = AppDataSource.getRepository(EquipmentType);
    const equipmentTypes = await equipmentTypeRepository.find({
      order: { name: "ASC" }
    });

    res.json(equipmentTypes.map(et => et.toDict()));
  } catch (error) {
    console.error("Error fetching equipment types:", error);
    res.status(500).json({ error: "Failed to fetch equipment types" });
  }
});

// POST /api/equipment-types
router.post("/", async (req, res) => {
  try {
    const equipmentTypeRepository = AppDataSource.getRepository(EquipmentType);
    const { name, fields } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const equipmentType = new EquipmentType();
    equipmentType.name = name;
    equipmentType.fields = fields;
    equipmentType.createdAt = new Date();

    await equipmentTypeRepository.save(equipmentType);
    res.status(201).json(equipmentType.toDict());
  } catch (error) {
    console.error("Error creating equipment type:", error);
    res.status(500).json({ error: "Failed to create equipment type" });
  }
});

// PUT /api/equipment-types/:id
router.put("/:id", async (req, res) => {
  try {
    const equipmentTypeRepository = AppDataSource.getRepository(EquipmentType);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const equipmentType = await equipmentTypeRepository.findOne({
      where: { id }
    });

    if (!equipmentType) {
      return res.status(404).json({ error: "Equipment type not found" });
    }

    const { name, fields } = req.body;

    if (name !== undefined) equipmentType.name = name;
    if (fields !== undefined) equipmentType.fields = fields;

    await equipmentTypeRepository.save(equipmentType);
    res.json(equipmentType.toDict());
  } catch (error) {
    console.error("Error updating equipment type:", error);
    res.status(500).json({ error: "Failed to update equipment type" });
  }
});

// DELETE /api/equipment-types/:id
router.delete("/:id", async (req, res) => {
  try {
    const equipmentTypeRepository = AppDataSource.getRepository(EquipmentType);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }
    const result = await equipmentTypeRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Equipment type not found" });
    }

    res.json({ message: "Equipment type deleted successfully" });
  } catch (error) {
    console.error("Error deleting equipment type:", error);
    res.status(500).json({ error: "Failed to delete equipment type" });
  }
});

export default router;
