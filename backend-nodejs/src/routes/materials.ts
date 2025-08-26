import express from "express";
import { AppDataSource } from "../data-source";
import { Material } from "../entities/Material";

const router = express.Router();

// GET /api/materials
router.get("/", async (req, res) => {
  try {
    const materialRepository = AppDataSource.getRepository(Material);
    const materials = await materialRepository.find({
      order: { name: "ASC" }
    });

    res.json(materials.map(m => m.toDict()));
  } catch (error) {
    console.error("Error fetching materials:", error);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

// GET /api/materials/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const materialRepository = AppDataSource.getRepository(Material);
    const material = await materialRepository.findOne({
      where: { id }
    });

    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json(material.toDict());
  } catch (error) {
    console.error("Error fetching material:", error);
    res.status(500).json({ error: "Failed to fetch material" });
  }
});

// POST /api/materials
router.post("/", async (req, res) => {
  try {
    const materialRepository = AppDataSource.getRepository(Material);
    const { name, material_type, active_ingredient, standard_amount } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const material = new Material();
    material.name = name;
    material.materialType = material_type;
    material.activeIngredient = active_ingredient;
    material.standardAmount = standard_amount;

    await materialRepository.save(material);
    res.status(201).json(material.toDict());
  } catch (error) {
    console.error("Error creating material:", error);
    res.status(500).json({ error: "Failed to create material" });
  }
});

// PUT /api/materials/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const materialRepository = AppDataSource.getRepository(Material);
    const material = await materialRepository.findOne({
      where: { id }
    });

    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const { name, material_type, active_ingredient, standard_amount } = req.body;

    if (name !== undefined) material.name = name;
    if (material_type !== undefined) material.materialType = material_type;
    if (active_ingredient !== undefined) material.activeIngredient = active_ingredient;
    if (standard_amount !== undefined) material.standardAmount = standard_amount;

    await materialRepository.save(material);
    res.json(material.toDict());
  } catch (error) {
    console.error("Error updating material:", error);
    res.status(500).json({ error: "Failed to update material" });
  }
});

// DELETE /api/materials/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const materialRepository = AppDataSource.getRepository(Material);
    const result = await materialRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json({ message: "Material deleted successfully" });
  } catch (error) {
    console.error("Error deleting material:", error);
    res.status(500).json({ error: "Failed to delete material" });
  }
});

export default router;
