import * as migration_20260623_182359 from './20260623_182359';
import * as migration_20260623_184742 from './20260623_184742';
import * as migration_20260623_185806 from './20260623_185806';
import * as migration_20260623_190931 from './20260623_190931';
import * as migration_20260623_210846 from './20260623_210846';
import * as migration_20260623_211442 from './20260623_211442';
import * as migration_20260623_212750 from './20260623_212750';
import * as migration_20260623_213906 from './20260623_213906';
import * as migration_20260628_145554_semantic_entities from './20260628_145554_semantic_entities';
import * as migration_20260628_210148_ai_article_fields from './20260628_210148_ai_article_fields';
import * as migration_20260629_155803_ai_provider_field from './20260629_155803_ai_provider_field';

export const migrations = [
  {
    up: migration_20260623_182359.up,
    down: migration_20260623_182359.down,
    name: '20260623_182359',
  },
  {
    up: migration_20260623_184742.up,
    down: migration_20260623_184742.down,
    name: '20260623_184742',
  },
  {
    up: migration_20260623_185806.up,
    down: migration_20260623_185806.down,
    name: '20260623_185806',
  },
  {
    up: migration_20260623_190931.up,
    down: migration_20260623_190931.down,
    name: '20260623_190931',
  },
  {
    up: migration_20260623_210846.up,
    down: migration_20260623_210846.down,
    name: '20260623_210846',
  },
  {
    up: migration_20260623_211442.up,
    down: migration_20260623_211442.down,
    name: '20260623_211442',
  },
  {
    up: migration_20260623_212750.up,
    down: migration_20260623_212750.down,
    name: '20260623_212750',
  },
  {
    up: migration_20260623_213906.up,
    down: migration_20260623_213906.down,
    name: '20260623_213906',
  },
  {
    up: migration_20260628_145554_semantic_entities.up,
    down: migration_20260628_145554_semantic_entities.down,
    name: '20260628_145554_semantic_entities',
  },
  {
    up: migration_20260628_210148_ai_article_fields.up,
    down: migration_20260628_210148_ai_article_fields.down,
    name: '20260628_210148_ai_article_fields',
  },
  {
    up: migration_20260629_155803_ai_provider_field.up,
    down: migration_20260629_155803_ai_provider_field.down,
    name: '20260629_155803_ai_provider_field'
  },
];
