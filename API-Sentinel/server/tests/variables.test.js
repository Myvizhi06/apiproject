const { VariableEngine, BLOCKED_PROPERTIES } = require('../engines/execution/variableEngine');

describe('Variable Extraction & Substitution Engine', () => {
  const context = {
    steps: {
      Login: {
        status: 200,
        headers: {
          'x-auth-session': 'sess_999888',
          'content-type': 'application/json',
        },
        body: {
          token: 'jwt_secure_token_123',
          user: {
            id: 101,
            email: 'admin@sentinel.dev',
            permissions: ['read', 'write'],
          },
        },
        extracted: {
          jwtToken: 'jwt_secure_token_123',
        },
      },
      CreateOrder: {
        status: 201,
        body: {
          orderId: 'ord_555',
          items: [{ itemId: 'item_A', qty: 2 }],
        },
      },
    },
    variables: {
      globalEnv: 'staging',
      apiKey: 'key_xyz',
    },
  };

  test('resolves step body properties correctly', () => {
    const expr = 'steps.Login.body.token';
    expect(VariableEngine.resolveExpression(expr, context)).toBe('jwt_secure_token_123');
  });

  test('resolves nested array items and sub-properties', () => {
    const expr = 'steps.CreateOrder.body.items[0].itemId';
    expect(VariableEngine.resolveExpression(expr, context)).toBe('item_A');
  });

  test('resolves headers and status codes', () => {
    expect(VariableEngine.resolveExpression('steps.Login.headers.x-auth-session', context)).toBe('sess_999888');
    expect(VariableEngine.resolveExpression('steps.Login.status', context)).toBe(200);
  });

  test('resolves global variables', () => {
    expect(VariableEngine.resolveExpression('variables.globalEnv', context)).toBe('staging');
  });

  test('interpolates variables inside string templates', () => {
    const url = '/api/orders/{{steps.CreateOrder.body.orderId}}?env={{variables.globalEnv}}';
    const resolved = VariableEngine.interpolateString(url, context);
    expect(resolved).toBe('/api/orders/ord_555?env=staging');

    const authHeader = 'Bearer {{steps.Login.body.token}}';
    expect(VariableEngine.interpolateString(authHeader, context)).toBe('Bearer jwt_secure_token_123');
  });

  test('substitutes variables recursively in objects and arrays', () => {
    const payload = {
      orderId: '{{steps.CreateOrder.body.orderId}}',
      headers: {
        Authorization: 'Bearer {{steps.Login.body.token}}',
      },
      tags: ['{{variables.globalEnv}}', 'audit'],
      nested: {
        userId: '{{steps.Login.body.user.id}}',
      },
    };

    const result = VariableEngine.substitute(payload, context);
    expect(result.orderId).toBe('ord_555');
    expect(result.headers.Authorization).toBe('Bearer jwt_secure_token_123');
    expect(result.tags).toEqual(['staging', 'audit']);
    expect(result.nested.userId).toBe(101);
  });

  test('blocks prototype pollution attempts securely', () => {
    expect(VariableEngine.safeGet(context, '__proto__.isAdmin')).toBeUndefined();
    expect(VariableEngine.safeGet(context, 'constructor.prototype')).toBeUndefined();
    expect(VariableEngine.resolveExpression('steps.Login.body.__proto__.polluted', context)).toBeUndefined();

    // Verify prototype was not polluted
    expect({}.polluted).toBeUndefined();
  });

  test('extracts configured variables from step result', () => {
    const stepConfig = {
      extract: {
        authToken: 'body.token',
        orderNumber: 'body.orderId',
      },
    };
    const stepResult = {
      body: {
        token: 'tok_abc',
        orderId: 'ord_123',
      },
    };

    const extracted = VariableEngine.extractVariables(stepConfig, stepResult);
    expect(extracted).toEqual({
      authToken: 'tok_abc',
      orderNumber: 'ord_123',
    });
  });
});
