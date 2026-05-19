import { useMemo, useState } from 'react';
import type { VideoRow } from '../../shared/types/video';
import {
  getResultsViewCounts,
  matchesResultsViewFilter
} from '../helpers/resultFilters';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

export interface UseResultFiltersValue {
  globalFilter: string;
  resultsViewFilter: ResultsViewFilter;
  resultsViewCounts: ResultsViewCounts;
  filteredVideoRows: VideoRow[];
  setGlobalFilter: (value: string) => void;
  setResultsViewFilter: (value: ResultsViewFilter) => void;
}

export function useResultFilters(visibleVideoRows: VideoRow[]): UseResultFiltersValue {
  const [globalFilter, setGlobalFilter] = useState('');
  const [resultsViewFilter, setResultsViewFilter] = useState<ResultsViewFilter>('all');

  const resultsViewCounts = useMemo(
    () => getResultsViewCounts(visibleVideoRows),
    [visibleVideoRows]
  );
  const filteredVideoRows = useMemo(
    () => visibleVideoRows.filter((row) => matchesResultsViewFilter(row, resultsViewFilter)),
    [resultsViewFilter, visibleVideoRows]
  );

  return {
    globalFilter,
    resultsViewFilter,
    resultsViewCounts,
    filteredVideoRows,
    setGlobalFilter,
    setResultsViewFilter
  };
}
