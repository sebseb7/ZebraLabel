import type {LabelSizeId} from './buildZpl';

export type LabelSize = {
  id: LabelSizeId;
  title: string;
  subtitle: string;
};

export const LABEL_SIZES: LabelSize[] = [
  {
    id: '25x13',
    title: '25,4 × 12,7',
    subtitle: 'mm',
  },
  {
    id: '47x81',
    title: '46,8 × 81',
    subtitle: 'mm · 90° CW print',
  },
  {
    id: '51x25',
    title: '50,8 × 25,4',
    subtitle: 'mm',
  },
];
