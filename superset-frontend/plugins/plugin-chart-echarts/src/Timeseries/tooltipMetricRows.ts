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
  type Currency,
  CurrencyFormatter,
  getMetricLabel,
  getNumberFormatter,
  isSavedMetric,
  type QueryFormMetric,
  resolveAutoCurrency,
  type TimeseriesDataRecord,
  type TooltipTruncationMode,
  truncateLabel,
} from '@superset-ui/core';
import { format as echartsFormat } from 'echarts/core';

export type TooltipMetricSpec = {
  key: string;
  label: string;
  format: (value: number) => string;
};

export type TooltipValues = Map<string, Map<string, Map<string, number>>>;

export type CreateTooltipMetricSpecsOptions = {
  tooltipMetrics: QueryFormMetric[];
  verboseMap?: Record<string, string>;
  columnFormats?: Record<string, string>;
  currencyFormats?: Record<string, Currency>;
  tooltipTruncation?: TooltipTruncationMode;
  // transformProps also passes the plotted axis options. Tooltip-only
  // metrics have independent units, so neither option formats these rows.
  yAxisFormat?: string;
  currencyFormat?: Currency;
  backendDetectedCurrency?: string | null;
  data?: TimeseriesDataRecord[];
  currencyCodeColumn?: string;
};

/**
 * Creates the display metadata and formatter for each tooltip-only metric.
 * Metric keys remain the raw query labels so they match `tooltipValues`, while
 * display labels use the datasource's verbose names when available.
 */
export function createTooltipMetricSpecs({
  tooltipMetrics,
  verboseMap = {},
  columnFormats = {},
  currencyFormats = {},
  tooltipTruncation,
  backendDetectedCurrency,
  data,
  currencyCodeColumn,
}: CreateTooltipMetricSpecsOptions): TooltipMetricSpec[] {
  return tooltipMetrics.map(metric => {
    const key = getMetricLabel(metric);
    // Saved formats belong to dataset metrics. An ad hoc expression can
    // have the same label as a saved metric while measuring something else.
    const saved = isSavedMetric(metric);
    const d3Format =
      saved && Object.hasOwn(columnFormats, key)
        ? columnFormats[key]
        : undefined;
    const currency =
      saved && Object.hasOwn(currencyFormats, key)
        ? resolveAutoCurrency(
            currencyFormats[key],
            backendDetectedCurrency,
            data,
            currencyCodeColumn,
          )
        : undefined;

    const displayLabel =
      saved && Object.hasOwn(verboseMap, key) ? verboseMap[key] || key : key;
    return {
      key,
      label: truncateLabel(displayLabel, tooltipTruncation),
      format: currency?.symbol
        ? new CurrencyFormatter({ d3Format, currency })
        : getNumberFormatter(d3Format),
    };
  });
}

/**
 * Returns the tooltip-only rows for one plotted series and x-axis value.
 * Missing and non-finite values are omitted, while zero is preserved.
 */
export function getTooltipMetricRows(
  metricSpecs: TooltipMetricSpec[],
  tooltipValues: TooltipValues,
  seriesKey: string,
  xValue: unknown,
): string[][] {
  const xKey = String(xValue);

  const rows: string[][] = [];
  for (const { key, label, format } of metricSpecs) {
    const value = tooltipValues.get(key)?.get(seriesKey)?.get(xKey);
    if (typeof value === 'number' && Number.isFinite(value)) {
      // tooltipHtml treats cells as HTML, so insert labels and numbers as text.
      rows.push([
        echartsFormat.encodeHTML(label),
        echartsFormat.encodeHTML(format(value)),
      ]);
    }
  }
  return rows;
}
