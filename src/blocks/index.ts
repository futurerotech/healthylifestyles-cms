import type { Block } from 'payload';
import { HeroBlock } from './Hero';
import { CalculatorEmbedBlock } from './CalculatorEmbed';
import { TwoColumnBlock } from './TwoColumn';
import { ViralHookBannerBlock } from './ViralHookBanner';

export { HeroBlock, CalculatorEmbedBlock, TwoColumnBlock, ViralHookBannerBlock };

export const pageBlocks: Block[] = [
  HeroBlock,
  CalculatorEmbedBlock,
  TwoColumnBlock,
  ViralHookBannerBlock,
];
