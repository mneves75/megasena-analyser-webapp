import { Archivo } from 'next/font/google';

// One family for the whole site; headings and numerals use its width axis
// (`font-stretch`) instead of a second face. `subsets` only selects preloads:
// every Google subset stays declared and loads by unicode-range when a page
// needs it. Page text is pt-BR (Latin-1), so only latin is preloaded.
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  axes: ['wdth'],
  variable: '--font-archivo',
});

/**
 * Font CSS variables for `<html>`. Shared by the root layout and
 * app/global-not-found.tsx, which renders its own document outside the layout.
 */
export const fontVariables = archivo.variable;
