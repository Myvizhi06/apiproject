/**
 * API Sentinel - ASL (API Sentinel Language) Recursive-Descent Parser
 * Produces structured AST with semantic validation and detailed error messages.
 */

const { TOKEN_TYPES, Tokenizer } = require('./tokenizer');

const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

class ParseError extends Error {
  constructor(message, line, column, context = null) {
    super(`Parse error at line ${line}, column ${column}: ${message}`);
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
    this.context = context;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.pos = 0;
  }

  static fromSource(source) {
    const tokenizer = new Tokenizer(source);
    const tokens = tokenizer.tokenize();
    return new Parser(tokens);
  }

  peek(offset = 0) {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
  }

  current() {
    return this.peek(0);
  }

  isAtEnd() {
    return this.current().type === TOKEN_TYPES.EOF;
  }

  advance() {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  match(...types) {
    for (const t of types) {
      if (this.current().type === t) {
        return this.advance();
      }
    }
    return null;
  }

  consume(type, expectedDescription) {
    if (this.current().type === type) {
      return this.advance();
    }
    const tok = this.current();
    throw new ParseError(
      `Expected ${expectedDescription}, but got '${tok.value || tok.type}'`,
      tok.line,
      tok.column
    );
  }

  /**
   * Parse full ASL document:
   * Workflow -> WORKFLOW Identifier { StepList }
   */
  parse() {
    if (this.isAtEnd()) {
      throw new ParseError('Empty document. Expected WORKFLOW declaration.', 1, 1);
    }

    const workflowToken = this.consume(TOKEN_TYPES.KEYWORD_WORKFLOW, "keyword 'WORKFLOW'");
    
    // Identifier for workflow name
    const nameToken = this.current();
    if (nameToken.type !== TOKEN_TYPES.IDENTIFIER && nameToken.type !== TOKEN_TYPES.STRING) {
      throw new ParseError(
        `Expected workflow identifier name, got '${nameToken.value || nameToken.type}'`,
        nameToken.line,
        nameToken.column
      );
    }
    this.advance();
    const workflowName = String(nameToken.value);

    // Opening brace
    this.consume(TOKEN_TYPES.LBRACE, "'{' after workflow identifier");

    const steps = [];
    const stepNameSet = new Set();

    while (this.current().type !== TOKEN_TYPES.RBRACE && !this.isAtEnd()) {
      // Optional semicolon/comma separation
      if (this.match(TOKEN_TYPES.SEMICOLON, TOKEN_TYPES.COMMA)) {
        continue;
      }

      const stepNode = this.parseStep(stepNameSet);
      steps.push(stepNode);
    }

    if (this.isAtEnd() && this.current().type !== TOKEN_TYPES.RBRACE) {
      throw new ParseError(
        `Missing closing brace '}' for workflow '${workflowName}'`,
        this.current().line,
        this.current().column
      );
    }

    this.consume(TOKEN_TYPES.RBRACE, "'}' to close workflow definition");

    // Optional trailing semicolons
    while (this.match(TOKEN_TYPES.SEMICOLON)) {}

    if (!this.isAtEnd()) {
      const extra = this.current();
      throw new ParseError(
        `Unexpected token '${extra.value || extra.type}' after workflow closing brace`,
        extra.line,
        extra.column
      );
    }

    if (steps.length === 0) {
      throw new ParseError(
        `Workflow '${workflowName}' must contain at least one step.`,
        workflowToken.line,
        workflowToken.column
      );
    }

    return {
      type: 'Workflow',
      name: workflowName,
      line: workflowToken.line,
      column: workflowToken.column,
      steps,
    };
  }

  /**
   * Step -> STEP Identifier { StatementList }
   */
  parseStep(stepNameSet) {
    const stepKeyword = this.consume(TOKEN_TYPES.KEYWORD_STEP, "keyword 'STEP'");
    const nameToken = this.current();

    if (nameToken.type !== TOKEN_TYPES.IDENTIFIER && nameToken.type !== TOKEN_TYPES.STRING) {
      throw new ParseError(
        `Expected step identifier name, got '${nameToken.value || nameToken.type}'`,
        nameToken.line,
        nameToken.column
      );
    }
    this.advance();
    const stepName = String(nameToken.value);

    // Duplicate step name check
    if (stepNameSet.has(stepName)) {
      throw new ParseError(
        `Duplicate step name '${stepName}'. Each step in a workflow must have a unique identifier.`,
        nameToken.line,
        nameToken.column
      );
    }
    stepNameSet.add(stepName);

    this.consume(TOKEN_TYPES.LBRACE, `'{' to begin step '${stepName}'`);

    const config = {
      name: stepName,
      method: null,
      url: null,
      expectedStatus: 200,
      retries: 0,
      timeoutMs: 10000,
      idempotent: false,
      headers: {},
      body: null,
      extract: {},
      dependsOn: [],
    };

    const statements = [];

    while (this.current().type !== TOKEN_TYPES.RBRACE && !this.isAtEnd()) {
      if (this.match(TOKEN_TYPES.SEMICOLON, TOKEN_TYPES.COMMA)) {
        continue;
      }
      const stmt = this.parseStatement(config);
      statements.push(stmt);
    }

    if (this.isAtEnd() && this.current().type !== TOKEN_TYPES.RBRACE) {
      throw new ParseError(
        `Missing closing brace '}' for step '${stepName}'`,
        this.current().line,
        this.current().column
      );
    }

    this.consume(TOKEN_TYPES.RBRACE, `Closing brace '}' for step '${stepName}'`);

    // Verify required statements
    if (!config.method) {
      throw new ParseError(
        `Step '${stepName}' is missing required 'METHOD' declaration (e.g., METHOD GET).`,
        stepKeyword.line,
        stepKeyword.column
      );
    }

    if (!config.url) {
      throw new ParseError(
        `Step '${stepName}' is missing required 'URL' declaration (e.g., URL "/api/items").`,
        stepKeyword.line,
        stepKeyword.column
      );
    }

    return {
      type: 'Step',
      name: stepName,
      line: stepKeyword.line,
      column: stepKeyword.column,
      config,
      statements,
    };
  }

  /**
   * Statement -> METHOD Value | URL String | EXPECT Number | RETRY Number | ...
   */
  parseStatement(config) {
    const tok = this.current();

    // METHOD
    if (this.match(TOKEN_TYPES.KEYWORD_METHOD)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.IDENTIFIER && valTok.type !== TOKEN_TYPES.STRING) {
        throw new ParseError(
          `Expected HTTP method (e.g., GET, POST, PUT, DELETE), got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      const methodStr = String(valTok.value).toUpperCase();
      if (!VALID_HTTP_METHODS.includes(methodStr)) {
        throw new ParseError(
          `Invalid HTTP method '${methodStr}'. Valid methods: ${VALID_HTTP_METHODS.join(', ')}`,
          valTok.line,
          valTok.column
        );
      }
      config.method = methodStr;
      return { type: 'Statement', keyword: 'METHOD', value: methodStr, line: tok.line, column: tok.column };
    }

    // URL
    if (this.match(TOKEN_TYPES.KEYWORD_URL)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.STRING && valTok.type !== TOKEN_TYPES.IDENTIFIER) {
        throw new ParseError(
          `Expected string URL after 'URL', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      config.url = String(valTok.value);
      return { type: 'Statement', keyword: 'URL', value: config.url, line: tok.line, column: tok.column };
    }

    // EXPECT
    if (this.match(TOKEN_TYPES.KEYWORD_EXPECT)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.NUMBER) {
        throw new ParseError(
          `Expected HTTP status code number after 'EXPECT', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      const statusNum = Number(valTok.value);
      if (!Number.isInteger(statusNum) || statusNum < 100 || statusNum > 599) {
        throw new ParseError(
          `Invalid HTTP status code '${valTok.value}'. Must be an integer between 100 and 599.`,
          valTok.line,
          valTok.column
        );
      }
      config.expectedStatus = statusNum;
      return { type: 'Statement', keyword: 'EXPECT', value: statusNum, line: tok.line, column: tok.column };
    }

    // RETRY
    if (this.match(TOKEN_TYPES.KEYWORD_RETRY)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.NUMBER) {
        throw new ParseError(
          `Expected number of retries after 'RETRY', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      const retryVal = Number(valTok.value);
      if (!Number.isInteger(retryVal) || retryVal < 0 || retryVal > 10) {
        throw new ParseError(
          `Invalid retry count '${valTok.value}'. Retry count must be an integer between 0 and 10.`,
          valTok.line,
          valTok.column
        );
      }
      config.retries = retryVal;
      return { type: 'Statement', keyword: 'RETRY', value: retryVal, line: tok.line, column: tok.column };
    }

    // HEADER Key Value
    if (this.match(TOKEN_TYPES.KEYWORD_HEADER)) {
      const keyTok = this.current();
      if (keyTok.type !== TOKEN_TYPES.STRING && keyTok.type !== TOKEN_TYPES.IDENTIFIER) {
        throw new ParseError(
          `Expected header name after 'HEADER', got '${keyTok.value || keyTok.type}'`,
          keyTok.line,
          keyTok.column
        );
      }
      this.advance();

      // Optional colon separator
      this.match(TOKEN_TYPES.COLON);

      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.STRING && valTok.type !== TOKEN_TYPES.IDENTIFIER && valTok.type !== TOKEN_TYPES.NUMBER) {
        throw new ParseError(
          `Expected header value for header '${keyTok.value}', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();

      config.headers[keyTok.value] = String(valTok.value);
      return {
        type: 'Statement',
        keyword: 'HEADER',
        key: keyTok.value,
        value: String(valTok.value),
        line: tok.line,
        column: tok.column,
      };
    }

    // BODY String
    if (this.match(TOKEN_TYPES.KEYWORD_BODY)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.STRING) {
        throw new ParseError(
          `Expected string payload after 'BODY', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      config.body = valTok.value;
      return { type: 'Statement', keyword: 'BODY', value: valTok.value, line: tok.line, column: tok.column };
    }

    // TIMEOUT Number
    if (this.match(TOKEN_TYPES.KEYWORD_TIMEOUT)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.NUMBER) {
        throw new ParseError(
          `Expected timeout milliseconds number after 'TIMEOUT', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      const timeoutMs = Number(valTok.value);
      if (timeoutMs < 50 || timeoutMs > 120000) {
        throw new ParseError(
          `Timeout must be between 50ms and 120000ms (got ${timeoutMs})`,
          valTok.line,
          valTok.column
        );
      }
      config.timeoutMs = timeoutMs;
      return { type: 'Statement', keyword: 'TIMEOUT', value: timeoutMs, line: tok.line, column: tok.column };
    }

    // IDEMPOTENT Boolean
    if (this.match(TOKEN_TYPES.KEYWORD_IDEMPOTENT)) {
      const valTok = this.current();
      if (valTok.type !== TOKEN_TYPES.BOOLEAN && valTok.type !== TOKEN_TYPES.IDENTIFIER) {
        throw new ParseError(
          `Expected boolean (true or false) after 'IDEMPOTENT', got '${valTok.value || valTok.type}'`,
          valTok.line,
          valTok.column
        );
      }
      this.advance();
      const boolVal = valTok.type === TOKEN_TYPES.BOOLEAN ? valTok.value : valTok.value.toLowerCase() === 'true';
      config.idempotent = boolVal;
      return { type: 'Statement', keyword: 'IDEMPOTENT', value: boolVal, line: tok.line, column: tok.column };
    }

    // EXTRACT Variable Path
    if (this.match(TOKEN_TYPES.KEYWORD_EXTRACT)) {
      const varTok = this.current();
      if (varTok.type !== TOKEN_TYPES.IDENTIFIER) {
        throw new ParseError(
          `Expected variable name after 'EXTRACT', got '${varTok.value || varTok.type}'`,
          varTok.line,
          varTok.column
        );
      }
      this.advance();

      const pathTok = this.current();
      if (pathTok.type !== TOKEN_TYPES.STRING && pathTok.type !== TOKEN_TYPES.IDENTIFIER) {
        throw new ParseError(
          `Expected path string after variable name in 'EXTRACT', got '${pathTok.value || pathTok.type}'`,
          pathTok.line,
          pathTok.column
        );
      }
      this.advance();

      config.extract[varTok.value] = pathTok.value;
      return {
        type: 'Statement',
        keyword: 'EXTRACT',
        variable: varTok.value,
        path: pathTok.value,
        line: tok.line,
        column: tok.column,
      };
    }

    // DEPENDS StepName
    if (this.match(TOKEN_TYPES.KEYWORD_DEPENDS)) {
      const depTok = this.current();
      if (depTok.type !== TOKEN_TYPES.IDENTIFIER && depTok.type !== TOKEN_TYPES.STRING) {
        throw new ParseError(
          `Expected prerequisite step identifier after 'DEPENDS', got '${depTok.value || depTok.type}'`,
          depTok.line,
          depTok.column
        );
      }
      this.advance();
      config.dependsOn.push(depTok.value);
      return {
        type: 'Statement',
        keyword: 'DEPENDS',
        value: depTok.value,
        line: tok.line,
        column: tok.column,
      };
    }

    throw new ParseError(
      `Unexpected token '${tok.value || tok.type}'. Valid statements: METHOD, URL, EXPECT, RETRY, HEADER, BODY, TIMEOUT, IDEMPOTENT, EXTRACT, DEPENDS.`,
      tok.line,
      tok.column
    );
  }
}

module.exports = {
  Parser,
  ParseError,
  VALID_HTTP_METHODS,
};

