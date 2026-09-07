import { useId, type CSSProperties } from 'react';
import type { Orientation, ShipName } from '../engine/types';

/**
 * Ships are drawn as one silhouette spanning all of their cells, in a coordinate
 * space of 100 units per cell: horizontal hulls run left (stern) to right (bow),
 * and vertical hulls reuse the same artwork rotated a quarter turn.
 */
const UNIT = 100;

export type ShipTone = 'afloat' | 'sunk' | 'preview' | 'invalid';

export interface ShipSpriteProps {
  name: ShipName;
  length: number;
  orientation: Orientation;
  /** Indices along the hull (0 = stern) that have been hit. */
  damage?: number[];
  tone?: ShipTone;
  className?: string;
  style?: CSSProperties;
}

interface Palette {
  top: string;
  bottom: string;
  deck: string;
  detail: string;
  edge: string;
  line: string;
}

const TONES: Record<ShipTone, Palette> = {
  afloat: {
    top: '#b8c6d9',
    bottom: '#42566e',
    deck: '#8ea3bb',
    detail: '#2b3a4f',
    edge: '#0b1523',
    line: '#e2e8f0',
  },
  sunk: {
    top: '#7c5a63',
    bottom: '#2f1a21',
    deck: '#5c3f49',
    detail: '#24121a',
    edge: '#120a0e',
    line: '#fda4af',
  },
  preview: {
    top: '#a7f3d0',
    bottom: '#059669',
    deck: '#6ee7b7',
    detail: '#064e3b',
    edge: '#022c22',
    line: '#ecfdf5',
  },
  invalid: {
    top: '#fecdd3',
    bottom: '#e11d48',
    deck: '#fb7185',
    detail: '#881337',
    edge: '#4c0519',
    line: '#fff1f2',
  },
};

/** Squared stern on the left, pointed prow on the right. */
function hullPath(w: number): string {
  const bow = w - 5;
  const shoulder = Math.max(w * 0.58, w - 130);
  return [
    `M 13 26`,
    `Q 13 13 27 13`,
    `H ${shoulder}`,
    `Q ${bow - 26} 15 ${bow} 50`,
    `Q ${bow - 26} 85 ${shoulder} 87`,
    `H 27`,
    `Q 13 87 13 74`,
    'Z',
  ].join(' ');
}

function Superstructure({ name, w, tone }: { name: ShipName; w: number; tone: Palette }) {
  const { deck, detail, line } = tone;

  switch (name) {
    case 'Carrier':
      return (
        <g>
          {/* flight deck with centre line and an island to starboard */}
          <rect x={22} y={26} width={w - 60} height={48} rx={10} fill={deck} />
          <line
            x1={44}
            y1={50}
            x2={w - 58}
            y2={50}
            stroke={line}
            strokeWidth={6}
            strokeDasharray="22 16"
            strokeLinecap="round"
            opacity={0.9}
          />
          <rect x={w * 0.55} y={18} width={54} height={26} rx={6} fill={detail} />
          <rect x={w * 0.55 + 38} y={2} width={8} height={18} rx={4} fill={detail} />
        </g>
      );
    case 'Battleship':
      return (
        <g>
          <rect x={26} y={30} width={w - 66} height={40} rx={9} fill={deck} />
          {/* fore and aft main turrets, guns trained forward */}
          <rect x={38} y={30} width={40} height={40} rx={10} fill={detail} />
          <rect x={w - 118} y={30} width={40} height={40} rx={10} fill={detail} />
          <line
            x1={w - 80}
            y1={50}
            x2={w - 34}
            y2={50}
            stroke={detail}
            strokeWidth={9}
            strokeLinecap="round"
          />
          {/* bridge tower, funnel and mast */}
          <rect x={w / 2 - 30} y={16} width={34} height={68} rx={9} fill={detail} />
          <rect x={w / 2 + 14} y={24} width={22} height={52} rx={7} fill={detail} />
          <line
            x1={w / 2 - 13}
            y1={16}
            x2={w / 2 - 13}
            y2={0}
            stroke={detail}
            strokeWidth={7}
            strokeLinecap="round"
          />
        </g>
      );
    case 'Cruiser':
      return (
        <g>
          <rect x={24} y={32} width={w - 62} height={36} rx={9} fill={deck} />
          <rect x={36} y={32} width={34} height={36} rx={9} fill={detail} />
          <rect x={w / 2 - 10} y={18} width={34} height={64} rx={9} fill={detail} />
          <rect x={w / 2 + 30} y={28} width={20} height={44} rx={6} fill={detail} />
          <line
            x1={w / 2 + 7}
            y1={18}
            x2={w / 2 + 7}
            y2={0}
            stroke={detail}
            strokeWidth={7}
            strokeLinecap="round"
          />
        </g>
      );
    case 'Submarine':
      return (
        <g>
          {/* low casing plus conning tower and periscope */}
          <rect x={24} y={40} width={w - 58} height={20} rx={10} fill={deck} />
          <path d={`M ${w / 2 - 30} 44 h 60 l -10 -30 h -40 Z`} fill={detail} />
          <line
            x1={w / 2}
            y1={16}
            x2={w / 2}
            y2={0}
            stroke={detail}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <line
            x1={w / 2 + 22}
            y1={14}
            x2={w / 2 + 22}
            y2={4}
            stroke={detail}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </g>
      );
    case 'Destroyer':
    default:
      return (
        <g>
          <rect x={22} y={34} width={w - 58} height={32} rx={8} fill={deck} />
          <rect x={34} y={34} width={28} height={32} rx={8} fill={detail} />
          <rect x={w / 2 - 12} y={20} width={30} height={60} rx={8} fill={detail} />
          <line
            x1={w / 2 + 3}
            y1={20}
            x2={w / 2 + 3}
            y2={0}
            stroke={detail}
            strokeWidth={7}
            strokeLinecap="round"
          />
        </g>
      );
  }
}

export function ShipSprite({
  name,
  length,
  orientation,
  damage = [],
  tone = 'afloat',
  className,
  style,
}: ShipSpriteProps) {
  const gradientId = useId();
  const palette = TONES[tone];
  const w = length * UNIT;
  const vertical = orientation === 'vertical';
  const sunk = tone === 'sunk';

  const artwork = (
    <>
      <path
        d={hullPath(w)}
        fill={`url(#${gradientId})`}
        stroke={palette.edge}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Superstructure name={name} w={w} tone={palette} />
      {/* waterline shadow along the hull */}
      <path
        d={`M 20 76 H ${w - 44}`}
        stroke={palette.edge}
        strokeOpacity={0.35}
        strokeWidth={8}
        strokeLinecap="round"
      />
      {damage.map((index) => {
        const cx = index * UNIT + UNIT / 2;
        return sunk ? (
          <g key={index} stroke="#fda4af" strokeWidth={7} strokeLinecap="round">
            <line x1={cx - 18} y1={32} x2={cx + 18} y2={68} />
            <line x1={cx + 18} y1={32} x2={cx - 18} y2={68} />
          </g>
        ) : (
          <g key={index}>
            <circle cx={cx} cy={50} r={26} fill="#0f172a" fillOpacity={0.85} />
            <circle
              cx={cx}
              cy={50}
              r={26}
              fill="none"
              stroke="#fb923c"
              strokeWidth={5}
            />
            <path
              d={`M ${cx - 9} 62 L ${cx + 2} 46 L ${cx - 3} 45 L ${cx + 9} 34 L ${cx + 3} 50 L ${cx + 8} 50 Z`}
              fill="#fde68a"
            />
          </g>
        );
      })}
    </>
  );

  return (
    <svg
      viewBox={vertical ? `0 0 ${UNIT} ${w}` : `0 0 ${w} ${UNIT}`}
      preserveAspectRatio="none"
      className={className}
      style={style}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor={palette.top} />
          <stop offset="0.6" stopColor={palette.bottom} />
          <stop offset="1" stopColor={palette.edge} />
        </linearGradient>
      </defs>
      {vertical ? (
        <g transform={`rotate(90) translate(0 -${UNIT})`}>{artwork}</g>
      ) : (
        artwork
      )}
    </svg>
  );
}
