/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { AdhocMetric } from '@superset-ui/core';
import { getTooltipOnlyMetrics } from '../../src/utils/tooltip';

const sales: AdhocMetric = {
  expressionType: 'SIMPLE',
  aggregate: 'SUM',
  column: { column_name: 'sales' },
  label: 'SUM(sales)',
  optionName: 'metric_sales',
};

const quantity: AdhocMetric = {
  expressionType: 'SIMPLE',
  aggregate: 'SUM',
  column: { column_name: 'quantity' },
  label: 'SUM(quantity)',
  optionName: 'metric_quantity',
};

test('getTooltipOnlyMetrics skips tooltip metrics that are already plotted', () => {
  // A separate adhoc metric that resolves to the same column label as `sales`.
  const salesAgain: AdhocMetric = {
    ...sales,
    optionName: 'metric_sales_again',
  };

  expect(
    getTooltipOnlyMetrics({
      plottedMetrics: [sales, 'count'],
      tooltipMetrics: [salesAgain, 'count', quantity],
    }),
  ).toEqual([quantity]);
});

test('getTooltipOnlyMetrics matches a saved and an adhoc metric by label even when their definitions differ', () => {
  // Both metrics have the label `count`, so only one can be queried, and the
  // plotted one wins.
  const adhocCount: AdhocMetric = {
    expressionType: 'SQL',
    sqlExpression: 'COUNT(DISTINCT id)',
    label: 'count',
    hasCustomLabel: true,
    optionName: 'metric_count',
  };

  expect(
    getTooltipOnlyMetrics({
      plottedMetrics: ['count'],
      tooltipMetrics: [adhocCount],
    }),
  ).toEqual([]);
});

test('getTooltipOnlyMetrics matches an unlabelled adhoc metric by its default label', () => {
  const unlabelledSales: AdhocMetric = {
    expressionType: 'SIMPLE',
    aggregate: 'SUM',
    column: { column_name: 'sales' },
    optionName: 'metric_sales_unlabelled',
  };

  expect(
    getTooltipOnlyMetrics({
      plottedMetrics: [sales],
      tooltipMetrics: [unlabelledSales],
    }),
  ).toEqual([]);
});

test('getTooltipOnlyMetrics skips a metric picked more than once and keeps the picked order', () => {
  // A separate adhoc metric that resolves to the same column label as
  // `quantity`. Its optionName differs, so the toEqual below also checks that
  // the first pick (`quantity`) is the one kept.
  const quantityAgain: AdhocMetric = {
    ...quantity,
    optionName: 'metric_quantity_again',
  };

  expect(
    getTooltipOnlyMetrics({
      plottedMetrics: [sales],
      tooltipMetrics: ['count', quantity, 'count', quantityAgain],
    }),
  ).toEqual(['count', quantity]);
});

test('getTooltipOnlyMetrics returns every tooltip metric when no metrics are plotted', () => {
  expect(getTooltipOnlyMetrics({ tooltipMetrics: [quantity] })).toEqual([
    quantity,
  ]);
  expect(
    getTooltipOnlyMetrics({ plottedMetrics: null, tooltipMetrics: [quantity] }),
  ).toEqual([quantity]);
});

test('getTooltipOnlyMetrics returns an empty list when no tooltip metrics are set', () => {
  expect(getTooltipOnlyMetrics({ plottedMetrics: [sales] })).toEqual([]);
  expect(
    getTooltipOnlyMetrics({ plottedMetrics: [sales], tooltipMetrics: null }),
  ).toEqual([]);
  expect(
    getTooltipOnlyMetrics({ plottedMetrics: [sales], tooltipMetrics: [] }),
  ).toEqual([]);
});
