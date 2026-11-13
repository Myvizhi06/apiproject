const { Tokenizer, LexerError } = require('../language/tokenizer');
const { Parser, ParseError } = require('../language/parser');
const { validateAST } = require('../language/validator');
const { astToWorkflow, workflowToAsl, parseAndValidate } = require('../language');

describe('ASL (API Sentinel Language) Tokenizer, Parser & Converter', () => {
  describe('Tokenizer', () => {
    test('tokenizes valid ASL keywords and identifiers with correct line/col', () => {
      const code = `WORKFLOW OrderFlow {\n  STEP Auth {\n    METHOD POST\n  }\n}`;
      const tokenizer = new Tokenizer(code);
      const tokens = tokenizer.tokenize();

      expect(tokens.length).toBeGreaterThan(5);
      expect(tokens[0].value).toBe('WORKFLOW');
      expect(tokens[0].line).toBe(1);
      expect(tokens[0].column).toBe(1);

      const stepToken = tokens.find(t => t.value === 'STEP');
      expect(stepToken.line).toBe(2);
      expect(stepToken.column).toBe(3);
    });

    test('ignores single-line and multi-line comments', () => {
      const code = `// Top comment\nWORKFLOW Demo /* inline block */ {\n  // step comment\n  STEP S1 { METHOD GET }\n}`;
      const tokenizer = new Tokenizer(code);
      const tokens = tokenizer.tokenize();
      const keywords = tokens.map(t => t.value);

      expect(keywords).toContain('WORKFLOW');
      expect(keywords).toContain('Demo');
      expect(keywords).toContain('STEP');
    });

    test('throws LexerError on unclosed string literal', () => {
      const code = `WORKFLOW Broken { STEP S1 { URL "unclosed string } }`;
      const tokenizer = new Tokenizer(code);
      expect(() => tokenizer.tokenize()).toThrow(LexerError);
    });

    test('throws LexerError on unexpected invalid character', () => {
      const code = `WORKFLOW Broken { @#$ }`;
      const tokenizer = new Tokenizer(code);
      expect(() => tokenizer.tokenize()).toThrow(LexerError);
    });
  });

  describe('Recursive-Descent Parser & AST', () => {
    test('parses full valid ASL script into comprehensive AST', () => {
      const code = `
        WORKFLOW CheckoutWorkflow {
          STEP Login {
            METHOD POST
            URL "/api/demo/login"
            EXPECT 200
            RETRY 2
            TIMEOUT 5000
            HEADER "Content-Type" "application/json"
            BODY "{\\"user\\": \\"admin\\"}"
            EXTRACT token "body.token"
          }

          STEP Products {
            METHOD GET
            URL "/api/demo/products"
            EXPECT 200
            DEPENDS Login
          }
        }
      `;

      const result = parseAndValidate(code);
      expect(result.validation.valid).toBe(true);
      expect(result.ast.name).toBe('CheckoutWorkflow');
      expect(result.ast.steps.length).toBe(2);

      const step1 = result.ast.steps[0];
      expect(step1.name).toBe('Login');
      expect(step1.config.method).toBe('POST');
      expect(step1.config.url).toBe('/api/demo/login');
      expect(step1.config.expectedStatus).toBe(200);
      expect(step1.config.retries).toBe(2);
      expect(step1.config.timeoutMs).toBe(5000);
      expect(step1.config.extract.token).toBe('body.token');

      const step2 = result.ast.steps[1];
      expect(step2.name).toBe('Products');
      expect(step2.config.dependsOn).toContain('Login');
    });

    test('detects missing closing brace with exact error location', () => {
      const code = `
        WORKFLOW Incomplete {
          STEP S1 {
            METHOD GET
            URL "/api/test"
        }
      `;
      expect(() => Parser.fromSource(code).parse()).toThrow(ParseError);
    });

    test('detects invalid HTTP method', () => {
      const code = `
        WORKFLOW InvalidMethod {
          STEP S1 {
            METHOD FETCH
            URL "/api/test"
          }
        }
      `;
      expect(() => Parser.fromSource(code).parse()).toThrow(/Invalid HTTP method/);
    });

    test('detects duplicate step identifiers in same workflow', () => {
      const code = `
        WORKFLOW DupStep {
          STEP StepA {
            METHOD GET
            URL "/api/1"
          }
          STEP StepA {
            METHOD GET
            URL "/api/2"
          }
        }
      `;
      expect(() => Parser.fromSource(code).parse()).toThrow(/Duplicate step name 'StepA'/);
    });

    test('detects invalid retry count values (> 10 or negative)', () => {
      const code = `
        WORKFLOW BadRetry {
          STEP S1 {
            METHOD GET
            URL "/api/1"
            RETRY 99
          }
        }
      `;
      expect(() => Parser.fromSource(code).parse()).toThrow(/Invalid retry count/);
    });

    test('detects cyclic dependencies between steps in semantic validation', () => {
      const code = `
        WORKFLOW CycleFlow {
          STEP StepA {
            METHOD GET
            URL "/api/a"
            DEPENDS StepB
          }
          STEP StepB {
            METHOD GET
            URL "/api/b"
            DEPENDS StepA
          }
        }
      `;
      const result = parseAndValidate(code);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.some(e => e.message.includes('Cyclic dependency'))).toBe(true);
    });
  });

  describe('AST Converter & Bidirectionality', () => {
    test('converts AST to executable workflow and back to ASL faithfully', () => {
      const code = `
        WORKFLOW RoundTrip {
          STEP StepOne {
            METHOD POST
            URL "/api/endpoint"
            EXPECT 201
            RETRY 3
            IDEMPOTENT true
            HEADER "Authorization" "Bearer test"
          }
        }
      `;
      const parsed = parseAndValidate(code);
      expect(parsed.validation.valid).toBe(true);

      const workflow = parsed.executableWorkflow;
      expect(workflow.name).toBe('RoundTrip');
      expect(workflow.steps[0].method).toBe('POST');
      expect(workflow.steps[0].expectedStatus).toBe(201);
      expect(workflow.steps[0].retries).toBe(3);
      expect(workflow.steps[0].idempotent).toBe(true);

      const regeneratedAsl = workflowToAsl(workflow);
      expect(regeneratedAsl).toContain('WORKFLOW RoundTrip');
      expect(regeneratedAsl).toContain('STEP StepOne');
      expect(regeneratedAsl).toContain('METHOD POST');
      expect(regeneratedAsl).toContain('EXPECT 201');

      // Ensure regenerated ASL parses without any errors
      const roundTripParsed = parseAndValidate(regeneratedAsl);
      expect(roundTripParsed.validation.valid).toBe(true);
    });
  });
});

