require('ts-node/register');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { MetaApiError, MetaApiService } = require('../src/services/MetaApiService');

test('MetaApiService returns ad accounts from Meta response payload', async () => {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/v18.0/me/adaccounts')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [{ id: 'act_123', name: 'Primary account', currency: 'USD' }],
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const service = new MetaApiService({
    baseUrl: `http://127.0.0.1:${address.port}`,
  });

  try {
    const accounts = await service.getAdAccounts('plain-token');
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].id, 'act_123');
    assert.equal(accounts[0].name, 'Primary account');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('MetaApiService normalizes Meta API errors', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          message: 'Invalid OAuth access token.',
          code: 190,
          type: 'OAuthException',
          fbtrace_id: 'TRACE123',
        },
      })
    );
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const service = new MetaApiService({
    baseUrl: `http://127.0.0.1:${address.port}`,
  });

  try {
    await assert.rejects(() => service.getAdAccounts('invalid-token'), (error) => {
      assert.ok(error instanceof MetaApiError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.metaCode, 190);
      assert.match(error.message, /Invalid OAuth access token/);
      return true;
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
