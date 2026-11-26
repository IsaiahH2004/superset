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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Timeseries/transformProps';
import { EchartsTimeseriesChartProps } from '../../src/types';

type Row = Record<string, string | number | null>;
type TooltipParam = { seriesName: string; value: [number, number] };
type SeriesWithLabel = {
  name?: string;
  data: unknown[];
  label?: {
    formatter?: (params: {
      value: unknown;
      dataIndex: number;
      seriesIndex: number;
    }) => string;
  };
};

const X = 1_600_000_000_000;

function transform({
  formData,
  data,
  labelMap = {},
  verboseMap = {},
}: {
  formData: Record<string, unknown>;
  data: Row[];
  labelMap?: Record<string, string[]>;
  verboseMap?: Record<string, string>;
}) {
  return transformProps(
    new ChartProps({
      formData: {
        datasource: '3__table',
        viz_type: 'echarts_timeseries',
        x_axis: 'ds',
        rich_tooltip: true,
        ...formData,
      },
      width: 800,
      height: 600,
      queriesData: [{ data, label_map: labelMap, colnames: [], coltypes: [] }],
      theme: supersetTheme,
      datasource: { verboseMap, columnFormats: {}, currencyFormats: {} },
    }) as unknown as EchartsTimeseriesChartProps,
  );
}

const seriesOf = (transformed: ReturnType<typeof transformProps>) =>
  transformed.echartOptions.series as SeriesWithLabel[];

const seriesNames = (transformed: ReturnType<typeof transformProps>) =>
  seriesOf(transformed)
    .map(series => series.name)
    .sort();

const legendNames = (transformed: ReturnType<typeof transformProps>) =>
  [...((transformed.echartOptions.legend as { data: string[] }).data ?? [])]
    .map(String)
    .sort();

/** Renders the tooltip and returns its rows as arrays of cell text. */
function tooltipRows(
  transformed: ReturnType<typeof transformProps>,
  params: TooltipParam[],
): string[][] {
  const { formatter } = transformed.echartOptions.tooltip as {
    formatter: (tooltipParams: unknown) => string;
  };
  const container = document.createElement('div');
  container.innerHTML = formatter(
    params.map(param => ({ ...param, seriesId: param.seriesName })),
  );
  return [...container.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('td')].map(cell =>
      (cell.textContent ?? '').trim(),
    ),
  );
}

test('does not plot a tooltip-only metric or list it in the legend', () => {
  const transformed = transform({
    formData: { metrics: ['rev'], tooltip_metrics: ['profit'] },
    data: [
      { ds: X, rev: 10, profit: 3 },
      { ds: X + 1, rev: 20, profit: 4 },
    ],
  });

  expect(seriesNames(transformed)).toEqual(['rev']);
  expect(legendNames(transformed)).not.toContain('profit');
});

test('leaves a tooltip-only metric out of the stacked total', () => {
  const transformed = transform({
    formData: {
      metrics: ['a', 'b'],
      tooltip_metrics: ['profit'],
      stack: 'Stack',
      show_value: true,
      only_total: true,
    },
    data: [{ ds: X, a: 1, b: 2, profit: 1000 }],
  });

  const totalLabels = seriesOf(transformed)
    .flatMap((series, seriesIndex) =>
      series.data.map((value, dataIndex) =>
        series.label?.formatter?.({ value, dataIndex, seriesIndex }),
      ),
    )
    .filter(label => label);

  expect(totalLabels).toEqual(['3']);
});

test('hides pivoted tooltip-only columns but keeps a series whose dimension value reads like the metric label', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit'],
      groupby: ['state'],
    },
    data: [{ ds: X, CA: 10, profit: 5, 'profit, CA': 3, 'profit, profit': 4 }],
    labelMap: {
      CA: ['CA'],
      // a plotted series for the dimension value "profit"
      profit: ['profit'],
      'profit, CA': ['profit', 'CA'],
      'profit, profit': ['profit', 'profit'],
    },
  });

  expect(seriesNames(transformed)).toEqual(['CA', 'profit']);
});

test('hides time-shifted and forecast columns of a tooltip-only metric', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit'],
      time_compare: ['1 year ago'],
      comparison_type: 'values',
    },
    data: [
      {
        ds: X,
        rev: 10,
        'rev__1 year ago': 8,
        profit: 3,
        'profit__1 year ago': 2,
        profit__yhat: 3,
        profit__yhat_lower: 2,
        profit__yhat_upper: 4,
      },
    ],
  });

  expect(seriesNames(transformed)).toEqual(['rev', 'rev__1 year ago']);
});

test('shows each dimension its own tooltip-only value beneath its plotted row', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit'],
      groupby: ['state'],
    },
    data: [{ ds: X, CA: 10, NY: 5, 'profit, CA': 333, 'profit, NY': 777 }],
    labelMap: {
      CA: ['CA'],
      NY: ['NY'],
      'profit, CA': ['profit', 'CA'],
      'profit, NY': ['profit', 'NY'],
    },
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'CA', value: [X, 10] },
    { seriesName: 'NY', value: [X, 5] },
  ]);

  expect(rows).toEqual([
    ['CA', '10'],
    ['profit', '333'],
    ['NY', '5'],
    ['profit', '777'],
  ]);
});

test('matches the raw-named pivoted columns of verbose-named metrics', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev', 'cost'],
      tooltip_metrics: ['profit'],
      groupby: ['state'],
    },
    data: [{ ds: X, 'rev, CA': 10, 'cost, CA': 4, 'profit, CA': 6 }],
    labelMap: {
      'rev, CA': ['rev', 'CA'],
      'cost, CA': ['cost', 'CA'],
      'profit, CA': ['profit', 'CA'],
    },
    verboseMap: { rev: 'Revenue', cost: 'Cost', profit: 'Profit' },
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'rev, CA', value: [X, 10] },
    { seriesName: 'cost, CA', value: [X, 4] },
  ]);

  expect(rows).toEqual([
    ['rev, CA', '10'],
    ['Profit', '6'],
    ['cost, CA', '4'],
    ['Profit', '6'],
  ]);
});

test('keeps tooltip-only rows beneath their plotted row in a stacked tooltip', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit', 'units'],
      groupby: ['state'],
      stack: 'Stack',
    },
    data: [
      {
        ds: X,
        CA: 10,
        NY: 5,
        'profit, CA': 333,
        'profit, NY': 777,
        'units, CA': 1,
        'units, NY': 2,
      },
    ],
    labelMap: {
      CA: ['CA'],
      NY: ['NY'],
      'profit, CA': ['profit', 'CA'],
      'profit, NY': ['profit', 'NY'],
      'units, CA': ['units', 'CA'],
      'units, NY': ['units', 'NY'],
    },
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'CA', value: [X, 10] },
    { seriesName: 'NY', value: [X, 5] },
  ]);

  // stacked tooltips list the topmost series first
  expect(rows).toEqual([
    ['NY', '5'],
    ['profit', '777'],
    ['units', '2'],
    ['CA', '10'],
    ['profit', '333'],
    ['units', '1'],
  ]);
});

test('matches a single plotted metric renamed to its time offset', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit'],
      groupby: ['state'],
      time_compare: ['1 year ago'],
      comparison_type: 'values',
    },
    data: [
      {
        ds: X,
        CA: 10,
        '1 year ago, CA': 8,
        'profit, CA': 333,
        'profit__1 year ago, CA': 222,
      },
    ],
    labelMap: {
      CA: ['CA'],
      '1 year ago, CA': ['1 year ago', 'CA'],
      'profit, CA': ['profit', 'CA'],
      'profit__1 year ago, CA': ['profit__1 year ago', 'CA'],
    },
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'CA', value: [X, 10] },
    { seriesName: '1 year ago, CA', value: [X, 8] },
  ]);

  expect(rows).toEqual([
    ['CA', '10'],
    ['profit', '333'],
    ['1 year ago, CA', '8'],
    ['profit', '222'],
  ]);
});

test('matches several plotted metrics renamed to `<metric>, <offset>`', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev', 'cost'],
      tooltip_metrics: ['profit'],
      groupby: ['state'],
      time_compare: ['1 year ago'],
      comparison_type: 'values',
    },
    data: [
      {
        ds: X,
        'rev, CA': 10,
        'rev, 1 year ago, CA': 8,
        'cost, CA': 4,
        'cost, 1 year ago, CA': 3,
        'profit, CA': 333,
        'profit__1 year ago, CA': 222,
      },
    ],
    labelMap: {
      'rev, CA': ['rev', 'CA'],
      'rev, 1 year ago, CA': ['rev, 1 year ago', 'CA'],
      'cost, CA': ['cost', 'CA'],
      'cost, 1 year ago, CA': ['cost, 1 year ago', 'CA'],
      'profit, CA': ['profit', 'CA'],
      'profit__1 year ago, CA': ['profit__1 year ago', 'CA'],
    },
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'rev, CA', value: [X, 10] },
    { seriesName: 'rev, 1 year ago, CA', value: [X, 8] },
  ]);

  expect(rows).toEqual([
    ['rev, CA', '10'],
    ['profit', '333'],
    ['rev, 1 year ago, CA', '8'],
    ['profit', '222'],
  ]);
});

test('skips missing tooltip values and keeps zeros', () => {
  const transformed = transform({
    formData: {
      metrics: ['rev'],
      tooltip_metrics: ['profit', 'units'],
    },
    data: [{ ds: X, rev: 10, profit: 0, units: null }],
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'rev', value: [X, 10] },
  ]);

  expect(rows).toEqual([
    ['rev', '10'],
    ['profit', '0'],
  ]);
});

test('reads tooltip values at the hovered x-axis value', () => {
  const transformed = transform({
    formData: { metrics: ['rev'], tooltip_metrics: ['profit'] },
    data: [
      { ds: X, rev: 10, profit: 1 },
      { ds: X + 1, rev: 20, profit: 2 },
    ],
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'rev', value: [X + 1, 20] },
  ]);

  expect(rows).toEqual([
    ['rev', '20'],
    ['profit', '2'],
  ]);
});

test('shows the original tooltip value when contribution mode is on', () => {
  const transformed = transform({
    formData: {
      metrics: ['a', 'b'],
      tooltip_metrics: ['profit'],
      contributionMode: 'row',
    },
    data: [{ ds: X, a: 0.25, b: 0.75, profit: 1234 }],
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'a', value: [X, 0.25] },
  ]);

  expect(rows[0]).toEqual(['a', '25%']);
  expect(rows[1]).toEqual(['profit', '1.23k']);
});

test('does not repeat a tooltip metric that is also plotted', () => {
  const transformed = transform({
    formData: { metrics: ['rev'], tooltip_metrics: ['rev'] },
    data: [{ ds: X, rev: 10 }],
  });

  const rows = tooltipRows(transformed, [
    { seriesName: 'rev', value: [X, 10] },
  ]);

  expect(seriesNames(transformed)).toEqual(['rev']);
  expect(rows).toEqual([['rev', '10']]);
});
