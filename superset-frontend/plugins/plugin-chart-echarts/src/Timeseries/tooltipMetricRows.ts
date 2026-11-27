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
  buildCustomFormatters,
  CurrencyFormatter,
  getCustomFormatter,
  getMetricLabel,
  getNumberFormatter,
  resolveAutoCurrency,
} from '@superset-ui/core';
import type {
  Currency,
  QueryFormMetric,
  TimeseriesDataRecord,
} from '@superset-ui/core';

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
  yAxisFormat,
  currencyFormat,
  backendDetectedCurrency,
  data,
  currencyCodeColumn,
}: CreateTooltipMetricSpecsOptions): TooltipMetricSpec[] {
  const resolvedCurrency = resolveAutoCurrency(
    currencyFormat,
    backendDetectedCurrency,
    data,
    currencyCodeColumn,
  );
  const defaultFormatter = resolvedCurrency?.symbol
    ? new CurrencyFormatter({
        d3Format: yAxisFormat,
        currency: resolvedCurrency,
      })
    : getNumberFormatter(yAxisFormat);
  const customFormatters = buildCustomFormatters(
    tooltipMetrics,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    resolvedCurrency,
    data,
    currencyCodeColumn,
  );

  return tooltipMetrics.map(metric => {
    const key = getMetricLabel(metric);
    const formatter =
      getCustomFormatter(customFormatters, [metric], key) ?? defaultFormatter;

    return {
      key,
      label: verboseMap[key] ?? key,
      format: value => formatter(value),
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

  return metricSpecs.flatMap(spec => {
    const value = tooltipValues.get(spec.key)?.get(seriesKey)?.get(xKey);
    return typeof value === 'number' && Number.isFinite(value)
      ? [[spec.label, spec.format(value)]]
      : [];
  });
}
