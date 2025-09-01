import express from "express";
import { AppDataSource } from "../data-source";
import { Feedback } from "../entities/Feedback";
import { Employee } from "../entities/Employee";
import { requireJwt, requireAdmin } from "./auth";

const router = express.Router();

// GET /api/feedback
router.get("/", async (req, res) => {
  try {
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    const { user_id, user_email, status } = req.query;

    let whereClause: any = {};
    
    if (user_id) {
      whereClause.userId = parseInt(user_id as string);
    }
    
    if (user_email) {
      whereClause.userEmail = user_email;
    }

    if (status) {
      whereClause.status = status;
    }

    const feedbacks = await feedbackRepository.find({
      where: whereClause,
      // Ikke hent relasjoner for å unngå kolonne-mismatches i employees-tabellen
      order: { createdAt: "DESC" }
    });

    res.json(feedbacks.map(feedback => feedback.toDict()));
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// GET /api/feedback/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const feedbackRepository = AppDataSource.getRepository(Feedback);
    const feedback = await feedbackRepository.findOne({
      where: { id }
    });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json(feedback.toDict());
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// POST /api/feedback
router.post("/", async (req, res) => {
  try {
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    const employeeRepository = AppDataSource.getRepository(Employee);

    const { user_id, user_email, text, context, diagnostics, status = "open" } = req.body;

    if (!text && !user_email) {
      return res.status(400).json({ error: "Either text or user_email is required" });
    }

    // Verify user exists if user_id provided
    if (user_id) {
      const user = await employeeRepository.findOne({
        where: { id: user_id }
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    const feedback = new Feedback();
    feedback.userId = user_id;
    feedback.userEmail = user_email;
    feedback.text = text;
    feedback.context = context;
    feedback.diagnostics = diagnostics;
    feedback.status = status;
    feedback.createdAt = new Date();

    await feedbackRepository.save(feedback);

    // Hent på nytt uten relasjoner
    const savedFeedback = await feedbackRepository.findOne({
      where: { id: feedback.id }
    });

    res.status(201).json(savedFeedback!.toDict());
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ error: "Failed to create feedback" });
  }
});

// PUT /api/feedback/:id
router.put("/:id", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    const employeeRepository = AppDataSource.getRepository(Employee);
    
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const feedback = await feedbackRepository.findOne({
      where: { id }
    });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const { text, context, diagnostics, status, handler_note, handled_by } = req.body;

    if (text !== undefined) feedback.text = text;
    if (context !== undefined) feedback.context = context;
    if (diagnostics !== undefined) feedback.diagnostics = diagnostics;
    if (status !== undefined) feedback.status = status;
    if (handler_note !== undefined) feedback.handlerNote = handler_note;
    
    if (handled_by !== undefined) {
      if (handled_by) {
        // Verify handler exists
        const handler = await employeeRepository.findOne({
          where: { id: handled_by }
        });
        if (!handler) {
          return res.status(404).json({ error: "Handler not found" });
        }
      }
      feedback.handledBy = handled_by;
    }
    
    feedback.updatedAt = new Date();

    await feedbackRepository.save(feedback);

    // Hent oppdatert feedback uten relasjoner
    const updatedFeedback = await feedbackRepository.findOne({
      where: { id: feedback.id }
    });

    res.json(updatedFeedback!.toDict());
  } catch (error) {
    console.error("Error updating feedback:", error);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// DELETE /api/feedback/:id
router.delete("/:id", requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be an integer" });
    }

    const feedbackRepository = AppDataSource.getRepository(Feedback);
    const result = await feedbackRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
