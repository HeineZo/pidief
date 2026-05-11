export type PatternKind =
  | 'dots'
  | 'lines'
  | 'cross'
  | 'diamond'
  | 'triangle'
  | 'ring'
  | 'square'
  | 'pill'
  | 'slash'
  | 'plus'
  | 'doubleLines'
  | 'hollowDiamond'
  | 'checker'
  | 'star'
  | 'bars';

export interface PageTint {
  color: string;
  labelColor: string;
  tintBg: string;
  tintBorder: string;
  pattern: PatternKind;
}

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
    pattern: 'diamond',
  },
  {
    color: '#B45309',
    labelColor: '#78350F',
    tintBg: '#FEF3C7',
    tintBorder: '#FCD34D',
    pattern: 'triangle',
  },
  {
    color: '#6B4F2A',
    labelColor: '#422006',
    tintBg: '#F5E6D3',
    tintBorder: '#C4A86A',
    pattern: 'ring',
  },
  {
    color: '#0F766E',
    labelColor: '#115E59',
    tintBg: '#DBF5F2',
    tintBorder: '#99DFD8',
    pattern: 'square',
  },
  {
    color: '#BE185D',
    labelColor: '#9D174D',
    tintBg: '#FCE7F3',
    tintBorder: '#F9A8D4',
    pattern: 'pill',
  },
  {
    color: '#9333EA',
    labelColor: '#6B21A8',
    tintBg: '#F3E8FF',
    tintBorder: '#D8B4FE',
    pattern: 'slash',
  },
  {
    color: '#0E7490',
    labelColor: '#155E75',
    tintBg: '#E0F2FE',
    tintBorder: '#7DD3FC',
    pattern: 'plus',
  },
  {
    color: '#15803D',
    labelColor: '#166534',
    tintBg: '#DCFCE7',
    tintBorder: '#86EFAC',
    pattern: 'doubleLines',
  },
  {
    color: '#C2410C',
    labelColor: '#9A3412',
    tintBg: '#FFEDD5',
    tintBorder: '#FDBA74',
    pattern: 'hollowDiamond',
  },
  {
    color: '#334155',
    labelColor: '#1E293B',
    tintBg: '#E2E8F0',
    tintBorder: '#94A3B8',
    pattern: 'checker',
  },
  {
    color: '#7C2D12',
    labelColor: '#9A3412',
    tintBg: '#FFEDD5',
    tintBorder: '#FDBA74',
    pattern: 'star',
  },
  {
    color: '#1D4ED8',
    labelColor: '#1E40AF',
    tintBg: '#DBEAFE',
    tintBorder: '#93C5FD',
    pattern: 'bars',
  },
] as const;

export function tintForFileIndex(index: number): PageTint {
  return PALETTE[index % PALETTE.length]!;
}
