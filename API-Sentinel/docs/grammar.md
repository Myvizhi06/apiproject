# ASL (API Sentinel Language) Formal Grammar Specification

## 1. Overview
The **API Sentinel Language (ASL)** is a declarative Domain-Specific Language (DSL) designed for expressing deterministic, multi-step API workflows, assertions, idempotency flags, and autonomous recovery parameters.

## 2. Lexical Grammar (EBNF)

```ebnf
Whitespace        ::= (' ' | '\t' | '\r' | '\n')+
CommentSingleLine ::= '//' [^\n]* '\n'
CommentMultiLine  ::= '/*' ( [^*] | '*'+ [^*/] )* '*'+ '/'

Letter            ::= [a-zA-Z]
Digit             ::= [0-9]
Identifier        ::= (Letter | '_' | '$') (Letter | Digit | '_' | '$' | '-' | '.')*

StringLiteral     ::= '"' ( [^"\\\n] | '\\' . )* '"' 
                    | "'" ( [^'\\\n] | '\\' . )* "'"
                    | '`' ( [^`\\] | '\\' . )* '`'

IntegerLiteral    ::= ['-']? Digit+
FloatLiteral      ::= ['-']? Digit+ '.' Digit+
NumberLiteral     ::= FloatLiteral | IntegerLiteral
BooleanLiteral    ::= 'true' | 'false'

KeywordWorkflow   ::= 'WORKFLOW' | 'workflow'
KeywordStep       ::= 'STEP' | 'step'
KeywordMethod     ::= 'METHOD' | 'method'
KeywordUrl        ::= 'URL' | 'url'
KeywordExpect     ::= 'EXPECT' | 'expect'
KeywordRetry      ::= 'RETRY' | 'retry'
KeywordHeader     ::= 'HEADER' | 'header'
KeywordBody       ::= 'BODY' | 'body'
KeywordTimeout    ::= 'TIMEOUT' | 'timeout'
KeywordIdempotent ::= 'IDEMPOTENT' | 'idempotent'
KeywordExtract    ::= 'EXTRACT' | 'extract'
KeywordDepends    ::= 'DEPENDS' | 'depends'

SymbolLBrace      ::= '{'
SymbolRBrace      ::= '}'
SymbolColon       ::= ':'
SymbolSemicolon   ::= ';'
SymbolComma       ::= ','
```

## 3. Context-Free Grammar (CFG in BNF)

```bnf
<Workflow>        ::= KeywordWorkflow <Identifier> SymbolLBrace <StepList> SymbolRBrace

<StepList>        ::= <Step> <StepList>
                    | ε

<Step>            ::= KeywordStep <Identifier> SymbolLBrace <StatementList> SymbolRBrace

<StatementList>   ::= <Statement> <StatementList>
                    | ε

<Statement>       ::= <MethodStmt>
                    | <UrlStmt>
                    | <ExpectStmt>
                    | <RetryStmt>
                    | <HeaderStmt>
                    | <BodyStmt>
                    | <TimeoutStmt>
                    | <IdempotentStmt>
                    | <ExtractStmt>
                    | <DependsStmt>
                    | SymbolSemicolon
                    | SymbolComma

<MethodStmt>      ::= KeywordMethod <HttpMethod>
<HttpMethod>      ::= "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"

<UrlStmt>         ::= KeywordUrl <StringLiteral>

<ExpectStmt>      ::= KeywordExpect NumberLiteral

<RetryStmt>       ::= KeywordRetry NumberLiteral

<HeaderStmt>      ::= KeywordHeader <HeaderKey> [SymbolColon] <HeaderValue>
<HeaderKey>       ::= <StringLiteral> | <Identifier>
<HeaderValue>     ::= <StringLiteral> | <Identifier> | NumberLiteral

<BodyStmt>        ::= KeywordBody <StringLiteral>

<TimeoutStmt>     ::= KeywordTimeout NumberLiteral

<IdempotentStmt>  ::= KeywordIdempotent BooleanLiteral

<ExtractStmt>     ::= KeywordExtract <Identifier> <StringLiteral>

<DependsStmt>     ::= KeywordDepends <Identifier>
```

## 4. Semantic Constraints
1. **Uniqueness**: All `<Step>` identifiers within a single `<Workflow>` must be distinct. Duplicate names trigger a fatal `ParseError`.
2. **Mandatory Statements**: Every `<Step>` block must declare at least one `METHOD` and one `URL`.
3. **HTTP Status Code Range**: `EXPECT` must evaluate to an integer $s \in [100, 599]$.
4. **Retry Boundaries**: `RETRY` must evaluate to an integer $r \in [0, 10]$.
5. **Acyclicity (DAG)**: Dependencies declared via `DEPENDS` must form a Directed Acyclic Graph (no cycles).
6. **Idempotency Guard**: Steps utilizing non-idempotent methods (`POST`, `PATCH`) with $r > 0$ must declare `IDEMPOTENT true` or supply an `Idempotency-Key` header; otherwise, a semantic compiler warning is emitted.

