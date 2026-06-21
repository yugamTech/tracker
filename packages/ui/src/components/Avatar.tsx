import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontWeights } from '../theme/typography';

interface AvatarProps {
  name: string;
  size?: number;
  imageUri?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 40 }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hue = name.charCodeAt(0) * 13 % 360;
  const bg = `hsl(${hue}, 60%, 50%)`;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textInverse,
    fontWeight: fontWeights.bold,
  },
});
