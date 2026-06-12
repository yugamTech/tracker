import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { colors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  shadow?: 'sm' | 'md' | 'lg' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 4,
  shadow = 'md',
}) => {
  return (
    <View
      style={[
        styles.card,
        { padding: spacing[padding] },
        shadow !== 'none' && shadows[shadow],
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
