/**
 * API Sentinel - Workflow Controller
 * Enforces strict per-user tenant ownership isolation.
 */

const { Workflow } = require('../models');
const { workflowToAsl } = require('../language');

class WorkflowController {
  static async list(req, res, next) {
    try {
      const ownerId = String(req.user.id);
      const queryResult = await Workflow.find({ ownerId });
      const workflows = Array.isArray(queryResult) ? queryResult : await queryResult.exec();

      res.json({
        count: workflows.length,
        workflows,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const workflow = await Workflow.findById(id);

      if (!workflow) {
        return res.status(404).json({ error: 'NotFound', message: 'Workflow not found.' });
      }

      if (String(workflow.ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not own this workflow.',
        });
      }

      res.json({ workflow });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const { name, description, steps, workflowDefinition } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'BadRequest', message: 'Workflow name is required.' });
      }

      const formattedSteps = Array.isArray(steps) ? steps : [];
      let def = workflowDefinition;
      if (!def && formattedSteps.length > 0) {
        def = workflowToAsl({ name: name.trim(), steps: formattedSteps });
      }

      const workflow = await Workflow.create({
        name: name.trim(),
        description: description || '',
        steps: formattedSteps,
        workflowDefinition: def || '',
        ownerId: String(req.user.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({
        message: 'Workflow created successfully',
        workflow,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const workflow = await Workflow.findById(id);

      if (!workflow) {
        return res.status(404).json({ error: 'NotFound', message: 'Workflow not found.' });
      }

      if (String(workflow.ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not own this workflow.',
        });
      }

      const { name, description, steps, workflowDefinition } = req.body;
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description;
      if (steps) updateData.steps = steps;
      if (workflowDefinition !== undefined) updateData.workflowDefinition = workflowDefinition;
      updateData.updatedAt = new Date();

      const updated = await Workflow.findByIdAndUpdate(id, updateData, { new: true });

      res.json({
        message: 'Workflow updated successfully',
        workflow: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const workflow = await Workflow.findById(id);

      if (!workflow) {
        return res.status(404).json({ error: 'NotFound', message: 'Workflow not found.' });
      }

      if (String(workflow.ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not own this workflow.',
        });
      }

      await Workflow.findByIdAndDelete(id);

      res.json({
        message: 'Workflow deleted successfully',
        id,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reorderSteps(req, res, next) {
    try {
      const { id } = req.params;
      const { stepIds } = req.body; // Array of step IDs in new order

      if (!Array.isArray(stepIds)) {
        return res.status(400).json({ error: 'BadRequest', message: 'stepIds array is required.' });
      }

      const workflow = await Workflow.findById(id);
      if (!workflow) {
        return res.status(404).json({ error: 'NotFound', message: 'Workflow not found.' });
      }

      if (String(workflow.ownerId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
      }

      const stepMap = new Map((workflow.steps || []).map(s => [s.id || s.name, s]));
      const newSteps = [];

      for (const stepId of stepIds) {
        if (stepMap.has(stepId)) {
          newSteps.push(stepMap.get(stepId));
        }
      }

      // Re-assign step orders
      newSteps.forEach((s, idx) => { s.order = idx + 1; });

      const updated = await Workflow.findByIdAndUpdate(id, { steps: newSteps }, { new: true });

      res.json({
        message: 'Steps reordered successfully',
        steps: updated.steps,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WorkflowController;

