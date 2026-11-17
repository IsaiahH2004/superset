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
  echartsTimeSeriesQuery,
  echartsTimeSeriesQueryWithXAxisSort,
} from '../../src/sections/echartsTimeSeriesQuery';
import { expandControlConfig } from '../../src/utils/expandControlConfig';
import type {
  ControlPanelSectionConfig,
  ControlSetItem,
  ControlSetRow,
} from '../../src/types';

// The two shared Query sections for the ECharts timeseries charts.
const sections: [string, ControlPanelSectionConfig][] = [
  ['echartsTimeSeriesQuery', echartsTimeSeriesQuery],
  ['echartsTimeSeriesQueryWithXAxisSort', echartsTimeSeriesQueryWithXAxisSort],
];

const getItemName = (item: ControlSetItem): string | null => {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object' && 'name' in item) {
    return typeof item.name === 'string' ? item.name : null;
  }
  return null;
};

const getRowNames = (rows: ControlSetRow[]): (string | null)[][] =>
  rows.map(row => row.map(getItemName));

test.each(sections)(
  'places tooltip_metrics directly under metrics in %s',
  (_, section) => {
    const rowNames = getRowNames(section.controlSetRows);
    const metricsRowIndex = rowNames.findIndex(
      row => row.length === 1 && row[0] === 'metrics',
    );

    expect(metricsRowIndex).toBeGreaterThanOrEqual(0);
    expect(rowNames[metricsRowIndex + 1]).toEqual(['tooltip_metrics']);
  },
);

test.each(sections)(
  'tooltip_metrics is optional in %s so existing charts stay valid',
  (_, section) => {
    const item = section.controlSetRows
      .flat()
      .find(controlItem => getItemName(controlItem) === 'tooltip_metrics');

    expect(item).toBeDefined();
    expect(expandControlConfig(item ?? null)).toMatchObject({
      name: 'tooltip_metrics',
      config: { validators: [] },
    });
  },
);
