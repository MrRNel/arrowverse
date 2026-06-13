import { CROSSOVER_EVENTS } from '../data/gamification/crossovers.data';
import { ArrowverseEpisode, TimelineSegment } from '../models/episode.model';

function rowsInRange(start: number, end: number): number[] {
  if (end < start) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function arcLabel(episodes: ArrowverseEpisode[], startRow: number, endRow: number): string {
  const inRange = episodes.filter(
    (episode) => episode.row_number >= startRow && episode.row_number <= endRow,
  );
  const seriesNames = [...new Set(inRange.map((episode) => episode.series))];

  if (seriesNames.length === 1) {
    return `${seriesNames[0]} arc`;
  }

  if (seriesNames.length === 2) {
    return `${seriesNames[0]} & ${seriesNames[1]}`;
  }

  return `Timeline arc #${startRow}–${endRow}`;
}

function buildSegment(
  watched: ReadonlySet<number>,
  upNextRow: number | null,
  config: {
    id: string;
    name: string;
    tagline: string;
    icon: string;
    kind: TimelineSegment['kind'];
    rows: number[];
  },
): TimelineSegment | null {
  if (config.rows.length === 0) {
    return null;
  }

  const watchedCount = config.rows.filter((row) => watched.has(row)).length;
  const startRow = config.rows[0];
  const endRow = config.rows[config.rows.length - 1];

  return {
    id: config.id,
    name: config.name,
    tagline: config.tagline,
    icon: config.icon,
    kind: config.kind,
    startRow,
    endRow,
    watched: watchedCount,
    total: config.rows.length,
    percent: Math.round((watchedCount / config.rows.length) * 100),
    complete: watchedCount === config.rows.length,
    active: upNextRow !== null && upNextRow >= startRow && upNextRow <= endRow,
  };
}

export function buildTimelineSegments(
  episodes: ArrowverseEpisode[],
  watched: ReadonlySet<number>,
  upNextRow: number | null,
): TimelineSegment[] {
  if (episodes.length === 0) {
    return [];
  }

  const maxRow = Math.max(...episodes.map((episode) => episode.row_number));
  const eventBlocks = [...CROSSOVER_EVENTS]
    .map((event) => ({
      ...event,
      minRow: Math.min(...event.rows),
      maxRow: Math.max(...event.rows),
    }))
    .sort((left, right) => left.minRow - right.minRow);

  const segments: TimelineSegment[] = [];
  let cursor = 1;

  for (const event of eventBlocks) {
    if (cursor < event.minRow) {
      const startRow = cursor;
      const endRow = event.minRow - 1;
      const segment = buildSegment(watched, upNextRow, {
        id: `arc-${startRow}-${endRow}`,
        name: arcLabel(episodes, startRow, endRow),
        tagline: `Rows #${startRow}–${endRow} before ${event.name}`,
        icon: 'pi pi-arrow-right',
        kind: 'arc',
        rows: rowsInRange(startRow, endRow),
      });

      if (segment) {
        segments.push(segment);
      }
    }

    const crossover = buildSegment(watched, upNextRow, {
      id: event.id,
      name: event.name,
      tagline: event.tagline,
      icon: event.icon,
      kind: 'crossover',
      rows: [...event.rows].sort((left, right) => left - right),
    });

    if (crossover) {
      segments.push(crossover);
    }

    cursor = event.maxRow + 1;
  }

  if (cursor <= maxRow) {
    const segment = buildSegment(watched, upNextRow, {
      id: `arc-${cursor}-${maxRow}`,
      name: arcLabel(episodes, cursor, maxRow),
      tagline: `Rows #${cursor}–${maxRow} after the last crossover event`,
      icon: 'pi pi-arrow-right',
      kind: 'arc',
      rows: rowsInRange(cursor, maxRow),
    });

    if (segment) {
      segments.push(segment);
    }
  }

  return segments;
}
