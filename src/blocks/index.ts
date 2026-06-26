import type { Block } from 'payload';
import { HeroBlock } from './Hero';
import { CalculatorEmbedBlock } from './CalculatorEmbed';
import { TwoColumnBlock } from './TwoColumn';
import { ViralHookBannerBlock } from './ViralHookBanner';
import { ToolEmbedBlock } from './ToolEmbed';
import { PeopleAlsoAskBlock } from './PeopleAlsoAsk';
import { TextBlock } from './TextBlock';
import { ListBlock } from './ListBlock';
import { CalloutBlock } from './CalloutBlock';
import { TableBlock } from './TableBlock';

export {
  HeroBlock, CalculatorEmbedBlock, TwoColumnBlock, ViralHookBannerBlock,
  ToolEmbedBlock, PeopleAlsoAskBlock, TextBlock, ListBlock, CalloutBlock, TableBlock,
};

export const pageBlocks: Block[] = [
  HeroBlock,
  CalculatorEmbedBlock,
  TwoColumnBlock,
  ViralHookBannerBlock,
  ToolEmbedBlock,
  PeopleAlsoAskBlock,
  TextBlock,
  ListBlock,
  CalloutBlock,
  TableBlock,
];
