import { Archivo } from 'next/font/google';

// One family for the whole site; headings and numerals use its width axis
// (`font-stretch`) instead of a second face.
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  axes: ['wdth'],
  variable: '--font-archivo',
});

/**
 * Font CSS variables for `<html>`. Shared by the root layout and
 * app/global-not-found.tsx, which renders its own document outside the layout.
 */
export const fontVariables = archivo.variable;
