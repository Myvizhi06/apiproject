/**
 * API Sentinel - ASL Controller
 * Provides endpoints for parsing, validating, converting, and saving ASL specifications.
 */

const {
  Tokenizer,
  Parser,
  validateAST,
  astToWorkflow,
  workflowToAsl,
  parseAndValidate,
} = require('../language');
const { Workflow } = require('../models');

class ASLController {
  static parse(req, res, next) {
    try {
      const { code } = req.body || {};
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'ASL code string is required.' });
      }

      const tokenizer = new Tokenizer(code);
      const tokens = tokenizer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      res.json({
        valid: true,
        ast,
        tokenCount: tokens.length,
      });
    } catch (err) {
      res.status(422).json({
        valid: false,
        error: err.name,
        message: err.message,
        line: err.line || 1,
        column: err.column || 1,
      });
    }
  }

  static validate(req, res, next) {
    try {
      const { code } = req.body || {};
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'ASL code string is required.' });
      }

      const result = parseAndValidate(code);
      res.json({
        valid: result.validation.valid,
        ast: result.ast,
        errors: result.validation.errors,
        warnings: result.validation.warnings,
        executableWorkflow: result.executableWorkflow,
      });
    } catch (err) {
      res.status(422).json({
        valid: false,
        errors: [{ message: err.message, line: err.line || 1, column: err.column || 1 }],
        warnings: [],
      });
    }
  }

  static convert(req, res, next) {
    try {
      const { ast, workflow } = req.body || {};

      if (ast) {
        const converted = astToWorkflow(ast);
        return res.json({ workflow: converted });
      }

      if (workflow) {
        const asl = workflowToAsl(workflow);
        return res.json({ asl });
      }

      return res.status(400).json({
        error: 'BadRequest',
        message: 'Either ast or workflow must be supplied for conversion.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async saveFromAsl(req, res, next) {
    try {
      const { code, description } = req.body || {};
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'ASL code string is required.' });
      }

      const result = parseAndValidate(code);
      if (!result.validation.valid) {
        return res.status(422).json({
          error: 'ValidationError',
          message: 'ASL code contains semantic or syntax errors.',
          errors: result.validation.errors,
        });
      }

      const execWorkflow = result.executableWorkflow;
      const savedWorkflow = await Workflow.create({
        name: execWorkflow.name,
        description: description || `Created via ASL compiler on ${new Date().toLocaleDateString()}`,
        steps: execWorkflow.steps,
        workflowDefinition: code,
        ownerId: String(req.user.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({
        message: 'Workflow successfully compiled and saved from ASL',
        workflow: savedWorkflow,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ASLController;

