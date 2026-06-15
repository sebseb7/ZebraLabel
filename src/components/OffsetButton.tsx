import React, {memo} from 'react';
import {Pressable, Text} from 'react-native';
import {styles} from '../appStyles';

type OffsetButtonProps = {
  label: string;
  onPress: () => void;
};

export const OffsetButton = memo(function OffsetButtonControl({label, onPress}: OffsetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.offsetButton, pressed && styles.pressed]}>
      <Text style={styles.offsetButtonText}>{label}</Text>
    </Pressable>
  );
});
