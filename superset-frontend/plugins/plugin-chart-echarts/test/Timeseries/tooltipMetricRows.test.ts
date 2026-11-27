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

import {
  createTooltipMetricSpecs,
  getTooltipMetricRows,
} from '../../src/Timeseries/tooltipMetricRows';
import { tooltipHtml } from '@superset-ui/core';
import type {
  TooltipMetricSpec,
  TooltipValues,
} from '../../src/Timeseries/tooltipMetricRows';

const xValue = 1_700_000_000_000;

test.each(['start', 'middle', 'end', 'off'] as const)(
  'respects %s label truncation without changing the lookup key or value',
  mode => {
    const label = 'Units <North> sold by the regional distribution center';
    const specs = createTooltipMetricSpecs({
      tooltipMetrics: ['units'],
      verboseMap: { units: label },
      tooltipTruncation: mode,
    });
    const values: TooltipValues = new Map([
      ['units', new Map([['|', new Map([['Q1', 7]])]])],
    ]);
    const el = document.createElement('div');
    el.innerHTML = tooltipHtml(getTooltipMetricRows(specs, values, '|', 'Q1'));
    const expectedLabel = {
      start: `…${label.slice(-39)}`,
      middle: `${label.slice(0, 20)}…${label.slice(-19)}`,
      end: label,
      off: label,
    }[mode];
    expect(
      [...el.querySelectorAll('td')].map(cell => cell.textContent),
    ).toEqual([expectedLabel, '7']);
  },
);

test.each([
  { currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' } },
  { yAxisFormat: '.0%' },
])(
  'uses plain numbers for an ad hoc quantity with chart settings %j',
  chart => {
    const [quantity] = createTooltipMetricSpecs({
      ...chart,
      tooltipMetrics: [
        {
          expressionType: 'SIMPLE',
          aggregate: 'SUM',
          column: { column_name: 'quantity_ordered' },
        },
      ],
    });
    expect(quantity.key).toBe('SUM(quantity_ordered)');
    expect(quantity.format(1234)).toBe('1.23k');
  },
);

test('preserves a saved ratio with the chart default Y-axis format', () => {
  const [ratio] = createTooltipMetricSpecs({
    tooltipMetrics: ['ratio'],
    columnFormats: { ratio: '.1%' },
    yAxisFormat: 'SMART_NUMBER',
  });
  expect(ratio.format(0.123)).toBe('12.3%');
});

test('an ad hoc expression keeps its own label when a dataset metric has the same name', () => {
  const [count] = createTooltipMetricSpecs({
    tooltipMetrics: [
      { expressionType: 'SQL', sqlExpression: 'COUNT(*)', label: 'total' },
    ],
    verboseMap: { total: 'Total cost' },
    currencyFormats: { total: { symbol: 'USD', symbolPosition: 'prefix' } },
    columnFormats: { total: '.2f' },
  });
  expect(count.label).toBe('total');
  expect(count.format(8)).toBe('8');
});

test('keeps the units of each tooltip metric with both chart overrides', () => {
  const specs = createTooltipMetricSpecs({
    tooltipMetrics: ['cost', 'share', 'count'],
    columnFormats: { cost: ',.2f', share: '.1%' },
    currencyFormats: { cost: { symbol: 'EUR', symbolPosition: 'suffix' } },
    yAxisFormat: '.0%',
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
  });

  const values: TooltipValues = new Map([
    ['cost', new Map([['|', new Map([['Q1', 1234.5]])]])],
    ['share', new Map([['|', new Map([['Q1', 0.123]])]])],
    ['count', new Map([['|', new Map([['Q1', 0]])]])],
  ]);
  expect(getTooltipMetricRows(specs, values, '|', 'Q1')).toEqual([
    ['cost', '1,234.50 €'],
    ['share', '12.3%'],
    ['count', '0'],
  ]);
});

test('resolves detected currency only for a metric whose saved currency is AUTO', () => {
  const [price, units] = createTooltipMetricSpecs({
    tooltipMetrics: ['price', 'units'],
    columnFormats: { price: '.2f' },
    currencyFormats: { price: { symbol: 'AUTO', symbolPosition: 'prefix' } },
    backendDetectedCurrency: 'GBP',
    currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
  });
  expect(price.format(12)).toBe('£ 12.00');
  expect(units.format(12)).toBe('12');
});

test('uses the saved numeric precision when AUTO has mixed currency codes', () => {
  const [price] = createTooltipMetricSpecs({
    tooltipMetrics: ['price'],
    columnFormats: { price: '.2f' },
    currencyFormats: { price: { symbol: 'AUTO', symbolPosition: 'prefix' } },
    currencyCodeColumn: 'code',
    data: [
      { __timestamp: xValue, code: 'USD' },
      { __timestamp: xValue + 1, code: 'EUR' },
    ],
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
  });
  expect(price.format(12)).toBe('12.00');
});

test('creates metric-specific number and currency formatters with verbose labels', () => {
  const specs = createTooltipMetricSpecs({
    tooltipMetrics: ['revenue', 'conversion_rate'],
    verboseMap: {
      revenue: 'Revenue',
      conversion_rate: 'Conversion rate',
    },
    columnFormats: {
      revenue: ',.2f',
      conversion_rate: '.1%',
    },
    currencyFormats: {
      revenue: { symbol: 'USD', symbolPosition: 'prefix' },
    },
  });

  expect(specs.map(({ key, label }) => ({ key, label }))).toEqual([
    { key: 'revenue', label: 'Revenue' },
    { key: 'conversion_rate', label: 'Conversion rate' },
  ]);
  expect(specs[0].format(1234.5)).toContain('$');
  expect(specs[0].format(1234.5)).toContain('1,234.50');
  expect(specs[1].format(0.123)).toBe('12.3%');
});

test('returns multiple tooltip rows in metric selection order and preserves zero', () => {
  const specs: TooltipMetricSpec[] = [
    { key: 'quantity', label: 'Quantity', format: String },
    { key: 'margin', label: 'Margin', format: value => `${value}%` },
  ];
  const values: TooltipValues = new Map([
    ['quantity', new Map([['|East', new Map([[String(xValue), 0]])]])],
    ['margin', new Map([['|East', new Map([[String(xValue), 12.5]])]])],
  ]);

  expect(getTooltipMetricRows(specs, values, '|East', xValue)).toEqual([
    ['Quantity', '0'],
    ['Margin', '12.5%'],
  ]);
});

test('matches grouped time-shifted values by the exact series and x-axis keys', () => {
  const specs: TooltipMetricSpec[] = [
    { key: 'quantity', label: 'Quantity', format: String },
  ];
  const values: TooltipValues = new Map([
    [
      'quantity',
      new Map([
        ['|East', new Map([[String(xValue), 10]])],
        ['1 year ago|East', new Map([[String(xValue), 8]])],
        ['1 year ago|West', new Map([[String(xValue), 6]])],
      ]),
    ],
  ]);

  expect(
    getTooltipMetricRows(specs, values, '1 year ago|East', xValue),
  ).toEqual([['Quantity', '8']]);
  expect(
    getTooltipMetricRows(specs, values, '1 year ago|West', xValue),
  ).toEqual([['Quantity', '6']]);
});

test('skips missing and non-finite values', () => {
  const specs: TooltipMetricSpec[] = [
    { key: 'missing', label: 'Missing', format: String },
    { key: 'nan', label: 'NaN', format: String },
    { key: 'infinite', label: 'Infinite', format: String },
  ];
  const values: TooltipValues = new Map([
    ['nan', new Map([['|East', new Map([[String(xValue), Number.NaN]])]])],
    [
      'infinite',
      new Map([
        ['|East', new Map([[String(xValue), Number.POSITIVE_INFINITY]])],
      ]),
    ],
  ]);

  expect(getTooltipMetricRows(specs, values, '|East', xValue)).toEqual([]);
});

test('returns no rows for an unselected metric, unknown group, or different x value', () => {
  const specs = createTooltipMetricSpecs({ tooltipMetrics: ['units'] });
  const values: TooltipValues = new Map([
    ['units', new Map([['|East', new Map([['Q1', 17]])]])],
  ]);
  expect(getTooltipMetricRows([], values, '|East', 'Q1')).toEqual([]);
  expect(getTooltipMetricRows(specs, values, '|West', 'Q1')).toEqual([]);
  expect(getTooltipMetricRows(specs, values, '|East', 'Q2')).toEqual([]);
});

test('displays a custom metric label literally in the rendered tooltip', () => {
  const label = 'Orders <target> & pending';
  const specs = createTooltipMetricSpecs({
    tooltipMetrics: [
      { expressionType: 'SQL', sqlExpression: 'COUNT(*)', label },
    ],
  });
  const values: TooltipValues = new Map([
    [label, new Map([['|', new Map([['Q1', 7]])]])],
  ]);
  const table = document.createElement('div');
  table.innerHTML = tooltipHtml(getTooltipMetricRows(specs, values, '|', 'Q1'));
  expect(table.querySelector('td')?.textContent).toBe(label);
});

test('formats the original lookup value instead of a contribution percentage', () => {
  const specs = createTooltipMetricSpecs({
    tooltipMetrics: ['revenue'],
    columnFormats: { revenue: ',.0f' },
    currencyFormats: {
      revenue: { symbol: 'USD', symbolPosition: 'prefix' },
    },
  });
  const values: TooltipValues = new Map([
    ['revenue', new Map([['|East', new Map([[String(xValue), 1250]])]])],
  ]);

  const rows = getTooltipMetricRows(specs, values, '|East', xValue);
  expect(rows[0][0]).toBe('revenue');
  expect(rows[0][1]).toContain('$');
  expect(rows[0][1]).toContain('1,250');
});
