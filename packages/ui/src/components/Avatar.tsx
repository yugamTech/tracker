import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontWeights } from '../theme/typography';

export interface AvatarProps {
  /** Full name — drives the initials and the deterministic background color. */
  name: string;
  /** Diameter in points. Default `40`. */
  size?: number;
  /** Optional photo. Falls back to initials when absent or while loading. */
  imageUri?: string;
}

/**
 * Circular avatar: shows the person's photo when `imageUri` is set, otherwise
 * up to two initials on a color derived deterministically from the name.
 *
 * @example
 * <Avatar name="Ramesh Kumar" size={48} imageUri={driver.photoUrl} />
 */
export const Avatar = forwardRef<React.ComponentRef<typeof View>, AvatarProps>(
  ({ name, size = 40, imageUri }, ref) => {
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
        ref={ref}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ]}
        accessibilityRole="image"
        accessibilityLabel={name}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
        )}
      </View>
    );
  },
);

Avatar.displayName = 'Avatar';

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.textInverse,
    fontWeight: fontWeights.bold,
  },
});
