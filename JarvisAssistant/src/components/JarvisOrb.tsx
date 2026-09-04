import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export type OrbState = 'idle' | 'listening' | 'speaking';

interface JarvisOrbProps {
  state: OrbState;
  size?: number;
}

export const JarvisOrb: React.FC<JarvisOrbProps> = ({ state, size = 120 }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    if (state === 'idle') {
      scale.value = withRepeat(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      opacity.value = withRepeat(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else if (state === 'listening') {
      scale.value = withRepeat(
        withTiming(1.15, { duration: 800, easing: Easing.out(Easing.cubic) }),
        -1,
        true
      );
      opacity.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        -1,
        true
      );
    } else if (state === 'speaking') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1.0, { duration: 200 }),
          withTiming(1.1, { duration: 150 }),
          withTiming(1.0, { duration: 250 })
        ),
        -1,
        false
      );
      opacity.value = 1;
    }
  }, [state, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const getColor = () => {
    switch (state) {
      case 'listening':
        return Colors.orbListening;
      case 'speaking':
        return Colors.orbSpeaking;
      default:
        return Colors.orbIdle;
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.orbWrapper, animatedStyle]}>
        <Svg height={size} width={size}>
          <Defs>
            <RadialGradient
              id="grad"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
              fx="50%"
              fy="50%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={getColor()} stopOpacity="1" />
              <Stop offset="70%" stopColor={getColor()} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={getColor()} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#grad)" />
        </Svg>
      </Animated.View>
      <View style={[styles.core, { backgroundColor: '#FFFFFF', width: size * 0.3, height: size * 0.3 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbWrapper: {
    position: 'absolute',
  },
  core: {
    borderRadius: 999,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  }
});
