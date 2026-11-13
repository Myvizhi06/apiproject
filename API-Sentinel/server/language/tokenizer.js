/**
 * API Sentinel - ASL (API Sentinel Language) Tokenizer
 * Lexical analyzer with line and column tracking and comment support.
 */

const TOKEN_TYPES = Object.freeze({
  KEYWORD_WORKFLOW: 'KEYWORD_WORKFLOW',
  KEYWORD_STEP: 'KEYWORD_STEP',
  KEYWORD_METHOD: 'KEYWORD_METHOD',
  KEYWORD_URL: 'KEYWORD_URL',
  KEYWORD_EXPECT: 'KEYWORD_EXPECT',
  KEYWORD_RETRY: 'KEYWORD_RETRY',
  KEYWORD_HEADER: 'KEYWORD_HEADER',
  KEYWORD_BODY: 'KEYWORD_BODY',
  KEYWORD_TIMEOUT: 'KEYWORD_TIMEOUT',
  KEYWORD_IDEMPOTENT: 'KEYWORD_IDEMPOTENT',
  KEYWORD_EXTRACT: 'KEYWORD_EXTRACT',
  KEYWORD_DEPENDS: 'KEYWORD_DEPENDS',
  IDENTIFIER: 'IDENTIFIER',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  SEMICOLON: 'SEMICOLON',
  COLON: 'COLON',
  COMMA: 'COMMA',
  EOF: 'EOF',
});

const KEYWORDS = {
  workflow: TOKEN_TYPES.KEYWORD_WORKFLOW,
  step: TOKEN_TYPES.KEYWORD_STEP,
  method: TOKEN_TYPES.KEYWORD_METHOD,
  url: TOKEN_TYPES.KEYWORD_URL,
  expect: TOKEN_TYPES.KEYWORD_EXPECT,
  retry: TOKEN_TYPES.KEYWORD_RETRY,
  header: TOKEN_TYPES.KEYWORD_HEADER,
  body: TOKEN_TYPES.KEYWORD_BODY,
  timeout: TOKEN_TYPES.KEYWORD_TIMEOUT,
  idempotent: TOKEN_TYPES.KEYWORD_IDEMPOTENT,
  extract: TOKEN_TYPES.KEYWORD_EXTRACT,
  depends: TOKEN_TYPES.KEYWORD_DEPENDS,
};

class LexerError extends Error {
  constructor(message, line, column) {
    super(`Lexer error at line ${line}, column ${column}: ${message}`);
    this.name = 'LexerError';
    this.line = line;
    this.column = column;
  }
}

class Tokenizer {
  constructor(input) {
    this.input = String(input || '');
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  tokenize() {
    this.tokens = [];
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }

      // Comments: // single-line and /* multi-line */
      if (ch === '/' && this.peek() === '/') {
        this.skipSingleLineComment();
        continue;
      }
      if (ch === '/' && this.peek() === '*') {
        this.skipMultiLineComment();
        continue;
      }

      // Braces and punctuation
      if (ch === '{') {
        this.pushToken(TOKEN_TYPES.LBRACE, '{');
        this.advance();
        continue;
      }
      if (ch === '}') {
        this.pushToken(TOKEN_TYPES.RBRACE, '}');
        this.advance();
        continue;
      }
      if (ch === ';') {
        this.pushToken(TOKEN_TYPES.SEMICOLON, ';');
        this.advance();
        continue;
      }
      if (ch === ':') {
        this.pushToken(TOKEN_TYPES.COLON, ':');
        this.advance();
        continue;
      }
      if (ch === ',') {
        this.pushToken(TOKEN_TYPES.COMMA, ',');
        this.advance();
        continue;
      }

      // Strings ('...' or "..." or multi-line template `...`)
      if (ch === '"' || ch === "'" || ch === '`') {
        this.readString(ch);
        continue;
      }

      // Numbers
      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek()))) {
        this.readNumber();
        continue;
      }

      // Identifiers / Keywords
      if (this.isIdentStart(ch)) {
        this.readIdentifierOrKeyword();
        continue;
      }

      throw new LexerError(`Unexpected character '${ch}'`, this.line, this.column);
    }

    this.pushToken(TOKEN_TYPES.EOF, '');
    return this.tokens;
  }

  peek(offset = 1) {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : '\0';
  }

  advance() {
    this.pos++;
    this.column++;
  }

  pushToken(type, value, startLine = this.line, startColumn = this.column) {
    this.tokens.push({
      type,
      value,
      line: startLine,
      column: startColumn,
    });
  }

  skipSingleLineComment() {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.advance();
    }
  }

  skipMultiLineComment() {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // skip /
    this.advance(); // skip *

    while (this.pos < this.input.length) {
      if (this.input[this.pos] === '*' && this.peek() === '/') {
        this.advance(); // skip *
        this.advance(); // skip /
        return;
      }
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
      } else {
        this.advance();
      }
    }

    throw new LexerError('Unterminated block comment', startLine, startCol);
  }

  readString(quoteChar) {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // skip initial quote
    let str = '';

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (ch === quoteChar) {
        this.advance(); // skip closing quote
        this.pushToken(TOKEN_TYPES.STRING, str, startLine, startCol);
        return;
      }

      if (ch === '\\') {
        this.advance();
        if (this.pos >= this.input.length) {
          throw new LexerError('Unterminated escape sequence in string', startLine, startCol);
        }
        const esc = this.input[this.pos];
        if (esc === 'n') str += '\n';
        else if (esc === 't') str += '\t';
        else if (esc === 'r') str += '\r';
        else if (esc === quoteChar) str += quoteChar;
        else if (esc === '\\') str += '\\';
        else str += esc;
        this.advance();
        continue;
      }

      if (ch === '\n' && quoteChar !== '`') {
        throw new LexerError('Unterminated string literal (newline in string)', startLine, startCol);
      }

      if (ch === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
        str += '\n';
        continue;
      }

      str += ch;
      this.advance();
    }

    throw new LexerError(`Unterminated string literal, expected closing ${quoteChar}`, startLine, startCol);
  }

  readNumber() {
    const startLine = this.line;
    const startCol = this.column;
    let numStr = '';

    if (this.input[this.pos] === '-') {
      numStr += '-';
      this.advance();
    }

    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      numStr += this.input[this.pos];
      this.advance();
    }

    if (this.pos < this.input.length && this.input[this.pos] === '.' && this.isDigit(this.peek())) {
      numStr += '.';
      this.advance();
      while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
        numStr += this.input[this.pos];
        this.advance();
      }
    }

    const value = Number(numStr);
    this.pushToken(TOKEN_TYPES.NUMBER, value, startLine, startCol);
  }

  readIdentifierOrKeyword() {
    const startLine = this.line;
    const startCol = this.column;
    let ident = '';

    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      ident += this.input[this.pos];
      this.advance();
    }

    const lower = ident.toLowerCase();

    if (lower === 'true' || lower === 'false') {
      this.pushToken(TOKEN_TYPES.BOOLEAN, lower === 'true', startLine, startCol);
      return;
    }

    if (KEYWORDS[lower]) {
      this.pushToken(KEYWORDS[lower], ident, startLine, startCol);
      return;
    }

    this.pushToken(TOKEN_TYPES.IDENTIFIER, ident, startLine, startCol);
  }

  isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  isIdentStart(ch) {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      ch === '$'
    );
  }

  isIdentPart(ch) {
    return (
      this.isIdentStart(ch) ||
      this.isDigit(ch) ||
      ch === '-' ||
      ch === '.'
    );
  }
}

module.exports = {
  TOKEN_TYPES,
  Tokenizer,
  LexerError,
};

