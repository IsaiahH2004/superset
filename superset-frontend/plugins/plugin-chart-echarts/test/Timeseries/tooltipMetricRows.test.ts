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
import type {
  TooltipMetricSpec,
  TooltipValues,
} from '../../src/Timeseries/tooltipMetricRows';

const xValue = 1_700_000_000_000;

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
