require('ts-node/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateConditions,
  getMetricValue,
  validateRuleConditions,
} = require('../src/utils/optimizationRules');
const { calculatePerformanceMetrics } = require('../src/utils/metrics');

const metrics = calculatePerformanceMetrics({
  impressions: 1000,
  reach: 500,
  clicks: 100,
  spend: 250,
  conversions: 5,
  conversionValue: 900,
});

test('evaluateConditions supports mixed operators for optimization rules', () => {
  const result = evaluateConditions(
    [
      { field: 'ctr', operator: 'gte', value: 0.08 },
      { field: 'cpa', operator: 'lte', value: 60 },
      { field: 'spend', operator: 'between', value: [200, 300] },
    ],
    metrics
  );

  assert.equal(result, true);
});

test('getMetricValue rejects unsupported metric fields', () => {
  assert.throws(() => getMetricValue(metrics, 'unknown_metric'), /Unsupported metric field/);
});

test('validateRuleConditions rejects invalid between payloads', () => {
  assert.throws(
    () => validateRuleConditions([{ field: 'spend', operator: 'between', value: [100] }]),
    /\[min, max\] range/
  );
});
