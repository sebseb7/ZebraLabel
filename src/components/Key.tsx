import React, {memo} from 'react';
import {Pressable, Text} from 'react-native';
import {styles} from '../appStyles';

type KeyProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  active?: boolean;
};

export const Key = memo(function KeyButton({
  label,
  onPress,
  variant = 'primary',
  active = false,
}: KeyProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.key,
        variant === 'secondary' && styles.secondaryKey,
        active && styles.activeKey,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.keyText, active && styles.activeKeyText]}>{label}</Text>
    </Pressable>
  );
});
