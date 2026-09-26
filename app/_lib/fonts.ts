import { Geist, Space_Grotesk } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-title',
});

/**
 * Font CSS variables for `<html>`. Shared by the root layout and
 * app/global-not-found.tsx, which renders its own document outside the layout.
 */
export const fontVariables = `${geist.variable} ${spaceGrotesk.variable}`;
