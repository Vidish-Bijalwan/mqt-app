import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * Brand lockup for headers and teal/dark surfaces (v1.1, item 142).
 * Renders the transparent logo asset derived from the business's own
 * logo (assets/logo-white.png / assets/logo-teal.png) — never the old
 * black-square logo.png. `size` is the rendered width in dp; height
 * follows the asset's aspect ratio (1056x322, h/w ≈ 0.305).
 */

const LOGO_WHITE = require('../../assets/logo-white.png');
const LOGO_TEAL = require('../../assets/logo-teal.png');

/** Aspect ratio (height / width) of logo-white.png / logo-teal.png. */
const ASPECT = 322 / 1056;

export function HeaderLogo({
  variant,
  size = 120,
}: {
  variant: 'white' | 'teal';
  size?: number;
}) {
  return (
    <Image
      source={variant === 'white' ? LOGO_WHITE : LOGO_TEAL}
      style={[styles.logo, { width: size, height: size * ASPECT }]}
      resizeMode="contain"
      accessibilityLabel="My Quick Trippers"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});
