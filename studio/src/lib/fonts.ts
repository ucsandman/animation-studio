import {loadFont as loadSaira} from '@remotion/google-fonts/Saira';
import {loadFont as loadHanken} from '@remotion/google-fonts/HankenGrotesk';
import {loadFont as loadGeistMono} from '@remotion/google-fonts/GeistMono';

// Load once at module scope; Remotion delays render until fonts resolve.
const saira = loadSaira('normal', {weights: ['600', '800']});
const hanken = loadHanken('normal', {weights: ['400', '600']});
const geistMono = loadGeistMono('normal', {weights: ['400', '500']});

export const loadBrandFonts = () => ({
  display: saira.fontFamily,
  body: hanken.fontFamily,
  mono: geistMono.fontFamily,
});
