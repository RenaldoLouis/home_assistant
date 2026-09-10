import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  hapticStyle?:
    | 'impactLight'
    | 'impactMedium'
    | 'impactHeavy'
    | 'selection'
    | 'notificationSuccess';
}

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  onPress,
  hapticStyle,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.get() }],
    };
  });

  const handlePressIn = () => {
    scale.set(
      withTiming(reducedMotion ? 1 : 0.97, {
        duration: 120,
        reduceMotion: ReduceMotion.System,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
  };

  const handlePressOut = () => {
    scale.set(
      withTiming(1, {
        duration: 120,
        reduceMotion: ReduceMotion.System,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
  };

  const handlePress = () => {
    if (hapticStyle)
      ReactNativeHapticFeedback.trigger(hapticStyle, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    if (onPress) {
      onPress();
    }
  };

  return (
    <AnimatedPressableBase
      style={[style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
};
