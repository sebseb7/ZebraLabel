export type LabelSizeId = '25x13' | '47x81' | '51x25';

export type LabelOffset = {
  xMm: number;
  yMm: number;
};

export const MAX_LABEL_OFFSET_MM = 5;
export const LABEL_OFFSET_STEP_MM = 0.5;

const DOTS_PER_MM = 203 / 25.4;
// ZD410 203 dpi: max 6 ips; lower speed improves text and graphic quality.
const PRINT_SPEED_IPS = 2;

function escapeZplField(value: string): string {
  return value.replace(/\^/g, '').replace(/~/g, '');
}

function formatPriceLabel(price: string): string {
  return escapeZplField(`${price} €`);
}

function offsetToDots(offset: LabelOffset): {x: number; y: number} {
  return {
    x: Math.round(offset.xMm * DOTS_PER_MM),
    y: Math.round(offset.yMm * DOTS_PER_MM),
  };
}

function labelHome(offset: LabelOffset): string {
  const {x, y} = offsetToDots(offset);
  return x === 0 && y === 0 ? '^LH0,0' : `^LH${x},${y}`;
}

function zplLabelStart(
  offset: LabelOffset,
  labelWidth: number,
  labelHeight: number,
): string {
  return `^XA
^CI28
^PR${PRINT_SPEED_IPS},${PRINT_SPEED_IPS},${PRINT_SPEED_IPS}
^PW${labelWidth}
^LL${labelHeight}
${labelHome(offset)}`;
}

function estimateFont0TextWidth(text: string, fontHeight: number): number {
  let width = 0;

  for (const char of text) {
    if (char === '1' || char === ',' || char === '.') {
      width += fontHeight * 0.3;
    } else if (char === ' ') {
      width += fontHeight * 0.25;
    } else if (char === '€') {
      width += fontHeight * 0.58;
    } else {
      width += fontHeight * 0.54;
    }
  }

  return Math.round(width);
}

function buildSmallLabelZpl(price: string, offset: LabelOffset): string {
  const labelWidth = 203;
  const labelHeight = 102;
  const fontHeight = 48;
  const pillHeight = 60;
  const textPaddingLeft = 14;
  const textPaddingRight = 10;
  const textNudgeY = 5;
  const maxPillWidth = labelWidth - 8;

  const textWidth = estimateFont0TextWidth(price, fontHeight);
  const pillWidth = Math.min(
    textWidth + textPaddingLeft + textPaddingRight,
    maxPillWidth,
  );
  const pillX = Math.round((labelWidth - pillWidth) / 2);
  const pillY = Math.round((labelHeight - pillHeight) / 2);
  const textX = pillX + textPaddingLeft;
  const textY =
    pillY + Math.round((pillHeight - fontHeight) / 2) + textNudgeY;
  const textFieldWidth = pillWidth - textPaddingLeft - textPaddingRight;

  return `${zplLabelStart(offset, labelWidth, labelHeight)}
^FO${pillX},${pillY}^GB${pillWidth},${pillHeight},${pillHeight},B,6^FS
^CF0,${fontHeight}
^FO${textX},${textY}^FB${textFieldWidth},1,0,L,0^FR^FD${price}^FS
^XZ
`;
}

function buildTallRotatedLabelZpl(price: string, offset: LabelOffset): string {
  return `${zplLabelStart(offset, 374, 648)}
^FO124,0^A0R,126,126^FB648,1,0,C,0^FD${price}^FS
^XZ
`;
}

function buildMediumLabelZpl(price: string, offset: LabelOffset): string {
  return `${zplLabelStart(offset, 406, 203)}
^CF0,86
^FO0,59^FB406,1,0,C,0^FD${price}^FS
^XZ
`;
}

export function labelDescription(labelSize: LabelSizeId): string {
  switch (labelSize) {
    case '25x13':
      return '25,4 x 12,7 mm';
    case '47x81':
      return '46,8 x 81 mm';
    case '51x25':
      return '50,8 x 25,4 mm';
    default:
      return '25,4 x 12,7 mm';
  }
}

export function buildZpl(
  price: string,
  labelSize: LabelSizeId,
  offset: LabelOffset = {xMm: 0, yMm: 0},
): string {
  const safePrice = formatPriceLabel(price);
  let zpl: string;

  switch (labelSize) {
    case '25x13':
      zpl = buildSmallLabelZpl(safePrice, offset);
      break;
    case '47x81':
      zpl = buildTallRotatedLabelZpl(safePrice, offset);
      break;
    case '51x25':
      zpl = buildMediumLabelZpl(safePrice, offset);
      break;
    default:
      zpl = buildSmallLabelZpl(safePrice, offset);
  }

  return `${zpl.trim()}\r\n`;
}
