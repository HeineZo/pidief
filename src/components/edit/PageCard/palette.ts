export type PatternKind = 'dots' | 'lines' | 'cross';

export interface PageTint {
  color: string;
  labelColor: string;
  tintBg: string;
  tintBorder: string;
  pattern: PatternKind;
}

/** Palette cyclique alignée sur la V3 (archives/Pidief Pages.html) + variantes. */
const PALETTE: readonly PageTint[] = [
  {
    color: '#C17F24',
    labelColor: '#7A4E0E',
    tintBg: '#FEF3D6',
    tintBorder: '#D4B87A',
    pattern: 'dots',
  },
  {
    color: '#7C5BA0',
    labelColor: '#50397A',
    tintBg: '#F0E8FA',
    tintBorder: '#C8B0E0',
    pattern: 'lines',
  },
  {
    color: '#3F8B6E',
    labelColor: '#2B6650',
    tintBg: '#E0F2EA',
    tintBorder: '#9FCAB8',
    pattern: 'cross',
  },
  {
    color: '#2563EB',
    labelColor: '#1E3A8A',
    tintBg: '#DBEAFE',
    tintBorder: '#93C5FD',
    pattern: 'dots',
  },
  {
    color: '#B45309',
    labelColor: '#78350F',
    tintBg: '#FEF3C7',
    tintBorder: '#FCD34D',
    pattern: 'lines',
  },
  {
    color: '#6B4F2A',
    labelColor: '#422006',
    tintBg: '#F5E6D3',
    tintBorder: '#C4A86A',
    pattern: 'cross',
  },
] as const;

export function tintForSourceIndex(index: number): PageTint {
  return PALETTE[index % PALETTE.length]!;
}
