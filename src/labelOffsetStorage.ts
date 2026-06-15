import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_LABEL_OFFSET_MM,
  type LabelOffset,
  type LabelSizeId,
} from './buildZpl';

const STORAGE_KEY = 'labelOffsets';
const LABEL_SIZE_IDS: LabelSizeId[] = ['25x13', '47x81', '51x25'];

const ZERO_OFFSET: LabelOffset = {xMm: 0, yMm: 0};

export const DEFAULT_LABEL_OFFSETS: Record<LabelSizeId, LabelOffset> = {
  '25x13': {...ZERO_OFFSET},
  '47x81': {...ZERO_OFFSET},
  '51x25': {...ZERO_OFFSET},
};

function clampOffset(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(MAX_LABEL_OFFSET_MM, Math.max(-MAX_LABEL_OFFSET_MM, value));
}

function parseOffset(value: unknown): LabelOffset {
  if (!value || typeof value !== 'object') {
    return {...ZERO_OFFSET};
  }

  const offset = value as {xMm?: unknown; yMm?: unknown};
  return {
    xMm: clampOffset(offset.xMm),
    yMm: clampOffset(offset.yMm),
  };
}

export function normalizeLabelOffsets(
  value: unknown,
): Record<LabelSizeId, LabelOffset> {
  const normalized: Record<LabelSizeId, LabelOffset> = {
    ...DEFAULT_LABEL_OFFSETS,
  };

  if (!value || typeof value !== 'object') {
    return normalized;
  }

  const stored = value as Partial<Record<LabelSizeId, unknown>>;
  for (const id of LABEL_SIZE_IDS) {
    if (stored[id]) {
      normalized[id] = parseOffset(stored[id]);
    }
  }

  return normalized;
}

export async function loadLabelOffsets(): Promise<
  Record<LabelSizeId, LabelOffset>
> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {...DEFAULT_LABEL_OFFSETS};
    }

    return normalizeLabelOffsets(JSON.parse(raw));
  } catch {
    return {...DEFAULT_LABEL_OFFSETS};
  }
}

export async function saveLabelOffsets(
  offsets: Record<LabelSizeId, LabelOffset>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(offsets));
  } catch {
    // Ignore persistence errors so printing still works offline.
  }
}
