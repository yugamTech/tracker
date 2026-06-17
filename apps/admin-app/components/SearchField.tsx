import React from 'react';
import { View, TextInput, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, radius, fontSizes } from '@saarthi/ui';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

/** Consistent search input: leading glyph, hairline border, pill radius. */
export function SearchField({ value, onChangeText, placeholder = 'Search…', style }: SearchFieldProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.glyph}>⌕</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[3],
  },
  glyph: { fontSize: fontSizes.lg, color: colors.textMuted, marginTop: -1 },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
});
