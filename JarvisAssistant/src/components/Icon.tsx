import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type IconName =
  | 'spark'
  | 'mic'
  | 'home'
  | 'calendar'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'settings'
  | 'food'
  | 'bag'
  | 'heart'
  | 'car'
  | 'wallet'
  | 'lamp'
  | 'speaker'
  | 'check';
const paths: Partial<Record<IconName, string>> = {
  spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  home: 'M3 10l9-7 9 7v10H15v-6H9v6H3Z',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  food: 'M5 3v6c0 3 6 3 6 0V3M8 3v18M19 3c-4 3-4 9 0 9V3v18',
  bag: 'M4 8h16l1 13H3L4 8ZM8 8V6a4 4 0 018 0v2',
  heart:
    'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8Z',
  car: 'M3 11l2-6h14l2 6v8H3v-8ZM3 11h18M6 15h2m8 0h2M6 19v2m12-2v2',
  wallet: 'M20 8V4H4a2 2 0 000 4h17v12H4a2 2 0 01-2-2V6m19 6h-5v4h5',
  lamp: 'M8 15c0-3-3-3-3-7a7 7 0 0114 0c0 4-3 4-3 7H8Zm1 4h6m-5 3h4',
  check: 'M5 12l4 4L19 6',
};
export function Icon({
  name,
  color = '#243C39',
  size = 24,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
    >
      {paths[name] && <Path d={paths[name]} />}
      {name === 'mic' && (
        <>
          <Rect x={9} y={2} width={6} height={12} rx={3} />
          <Path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={3} />
          <Path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2" />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path d="M4 6h16M4 12h16M4 18h16" />
          <Circle cx={9} cy={6} r={2} fill="#fff" />
          <Circle cx={15} cy={12} r={2} fill="#fff" />
          <Circle cx={8} cy={18} r={2} fill="#fff" />
        </>
      )}
      {name === 'speaker' && (
        <>
          <Rect x={5} y={2} width={14} height={20} rx={3} />
          <Circle cx={12} cy={15} r={4} />
          <Circle cx={12} cy={6} r={1} />
        </>
      )}
    </Svg>
  );
}
export function categoryAppearance(category: string): {
  icon: IconName;
  color: string;
  background: string;
} {
  if (/food|drink|meal|beverage|coffee/i.test(category))
    return { icon: 'food', color: '#196B65', background: '#E1F0EA' };
  if (/dating|love/i.test(category))
    return { icon: 'heart', color: '#A24C57', background: '#F9E5E4' };
  if (/transport|travel|fuel/i.test(category))
    return { icon: 'car', color: '#805E20', background: '#F7EDCD' };
  if (/shop|grocery/i.test(category))
    return { icon: 'bag', color: '#52622E', background: '#EAF0DA' };
  return { icon: 'wallet', color: '#5E608A', background: '#EDEBF6' };
}
