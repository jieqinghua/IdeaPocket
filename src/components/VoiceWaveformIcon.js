import Svg, { Path } from 'react-native-svg';

// Lucide audio-lines.svg (ISC): https://lucide.dev/icons/audio-lines
export default function VoiceWaveformIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path d="M2 10v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6v11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M10 3v18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 8v7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 5v13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M22 10v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
