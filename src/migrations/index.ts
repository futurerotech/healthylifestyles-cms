import * as migration_20260630_225705_init from './20260630_225705_init';

export const migrations = [
  {
    up: migration_20260630_225705_init.up,
    down: migration_20260630_225705_init.down,
    name: '20260630_225705_init'
  },
];
