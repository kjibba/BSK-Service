import express from "express";
import materialRoutes from "./materials";
import equipmentTypeRoutes from "./equipmentTypes";

const router = express.Router();

// GET /api/meta/bait-types -> /api/materials
router.use("/bait-types", materialRoutes);

// GET /api/meta/equipment-types -> /api/equipment-types
router.use("/equipment-types", equipmentTypeRoutes);

export default router;
