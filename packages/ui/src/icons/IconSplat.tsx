import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Splat, type SplatShape } from './Splat';
import { SpotIcon, type SpotIconName } from './SpotIcon';
import { Icon, type IconName } from './Icon';

export interface IconSplatProps {
  /** Brush shape behind the icon. Default `'b1'`. */
  shape?: SplatShape;
  /** Tint of the brush blob. */
  splatColor: string;
  /** Multi-colour spot icon to place on the splat. */
  spot?: SpotIconName;
  /** Duotone line icon to place on the splat (used when `spot` is omitted). */
  icon?: IconName;
  /** Tint for the duotone `icon`. */
  iconColor?: string;
  /** Anything custom to place on the splat (overrides `spot`/`icon`). */
  children?: React.ReactNode;
  /** Holder square size in points. Default `50`. */
  size?: number;
  /** Foreground icon size. Default ~56% of `size`. */
  iconSize?: number;
  /** Subtle rotation of the blob (degrees), as the reference tilts tab splats. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The reference's signature motif: a tintable brush {@link Splat} with an icon
 * floated on top. Give it a `spot` (multi-colour) or `icon` (duotone) — or pass
 * `children` for anything else.
 *
 * @example
 * <IconSplat shape="b1" splatColor={colors.gray100} spot="abandoned" size={50} />
 */
export const IconSplat: React.FC<IconSplatProps> = ({
  shape = 'b1',
  splatColor,
  spot,
  icon,
  iconColor,
  children,
  size = 50,
  iconSize,
  rotate,
  style,
}) => {
  const fgSize = iconSize ?? Math.round(size * 0.56);
  const blobSize = Math.round(size * 1.18);
  const fg =
    children ??
    (spot ? <SpotIcon name={spot} size={fgSize} /> : icon ? <Icon name={icon} size={fgSize} color={iconColor} /> : null);

  return (
    <View style={[{ width: size, height: size }, styles.holder, style]}>
      <Splat
        shape={shape}
        color={splatColor}
        size={blobSize}
        style={[styles.blob, rotate != null ? { transform: [{ rotate: `${rotate}deg` }] } : null]}
      />
      <View style={styles.fg}>{fg}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  holder: { alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute' },
  fg: { zIndex: 1 },
});
