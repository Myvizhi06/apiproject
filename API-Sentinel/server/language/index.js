/**
 * API Sentinel - ASL Language Module Export
 */

const { Tokenizer, TOKEN_TYPES, LexerError } = require('./tokenizer');
const { Parser, ParseError, VALID_HTTP_METHODS } = require('./parser');
const { validateAST, SemanticValidationError } = require('./validator');
const { astToWorkflow, workflowToAsl } = require('./converter');

function parseAndValidate(source) {
  const tokenizer = new Tokenizer(source);
  const tokens = tokenizer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const validation = validateAST(ast);

  return {
    tokens,
    ast,
    validation,
    executableWorkflow: validation.valid ? astToWorkflow(ast) : null,
  };
}

module.exports = {
  Tokenizer,
  TOKEN_TYPES,
  LexerError,
  Parser,
  ParseError,
  VALID_HTTP_METHODS,
  validateAST,
  SemanticValidationError,
  astToWorkflow,
  workflowToAsl,
  parseAndValidate,
};

