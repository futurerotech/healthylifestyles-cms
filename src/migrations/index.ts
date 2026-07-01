import * as migration_20260630_225705_init from './20260630_225705_init';
import * as migration_20260701_225833_s3_media_prefix from './20260701_225833_s3_media_prefix';
import * as migration_20260701_232459 from './20260701_232459';

export const migrations = [
  {
    up: migration_20260630_225705_init.up,
    down: migration_20260630_225705_init.down,
    name: '20260630_225705_init',
  },
  {
    up: migration_20260701_225833_s3_media_prefix.up,
    down: migration_20260701_225833_s3_media_prefix.down,
    name: '20260701_225833_s3_media_prefix',
  },
  {
    up: migration_20260701_232459.up,
    down: migration_20260701_232459.down,
    name: '20260701_232459'
  },
];
