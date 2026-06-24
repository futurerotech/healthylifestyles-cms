import * as migration_20260623_182359 from './20260623_182359';
import * as migration_20260623_184742 from './20260623_184742';
import * as migration_20260623_185806 from './20260623_185806';
import * as migration_20260623_190931 from './20260623_190931';
import * as migration_20260623_210846 from './20260623_210846';
import * as migration_20260623_211442 from './20260623_211442';
import * as migration_20260623_212750 from './20260623_212750';
import * as migration_20260623_213906 from './20260623_213906';

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
    name: '20260623_213906'
  },
];
