import * as migration_20260630_225705_init from './20260630_225705_init';
import * as migration_20260701_225833_s3_media_prefix from './20260701_225833_s3_media_prefix';
import * as migration_20260701_232459 from './20260701_232459';
import * as migration_20260702_183704_link_building from './20260702_183704_link_building';
import * as migration_20260702_191106_site_audits from './20260702_191106_site_audits';
import * as migration_20260703_123018_tool_risk_review from './20260703_123018_tool_risk_review';
import * as migration_20260704_010500_enable_rls_public from './20260704_010500_enable_rls_public';
import * as migration_20260704_020000_harden_rls_auto_enable from './20260704_020000_harden_rls_auto_enable';
import * as migration_20260705_165510_add_tools_semantic_entities from './20260705_165510_add_tools_semantic_entities';
import * as migration_20260707_113916_add_audit_collections from './20260707_113916_add_audit_collections';
import * as migration_20260707_152543_add_ai_settings_global from './20260707_152543_add_ai_settings_global';
import * as migration_20260707_235442_add_gsc_inspection_fields from './20260707_235442_add_gsc_inspection_fields';
import * as migration_20260709_171108_phase8_schema_flags from './20260709_171108_phase8_schema_flags';
import * as migration_20260711_184910 from './20260711_184910';
import * as migration_20261008_190423_add_reset_password_requested_at from './20261008_190423_add_reset_password_requested_at';
import * as migration_20261008_225200_add_media_object_key from './20261008_225200_add_media_object_key';

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
    name: '20260701_232459',
  },
  {
    up: migration_20260702_183704_link_building.up,
    down: migration_20260702_183704_link_building.down,
    name: '20260702_183704_link_building',
  },
  {
    up: migration_20260702_191106_site_audits.up,
    down: migration_20260702_191106_site_audits.down,
    name: '20260702_191106_site_audits',
  },
  {
    up: migration_20260703_123018_tool_risk_review.up,
    down: migration_20260703_123018_tool_risk_review.down,
    name: '20260703_123018_tool_risk_review',
  },
  {
    up: migration_20260704_010500_enable_rls_public.up,
    down: migration_20260704_010500_enable_rls_public.down,
    name: '20260704_010500_enable_rls_public',
  },
  {
    up: migration_20260704_020000_harden_rls_auto_enable.up,
    down: migration_20260704_020000_harden_rls_auto_enable.down,
    name: '20260704_020000_harden_rls_auto_enable',
  },
  {
    up: migration_20260705_165510_add_tools_semantic_entities.up,
    down: migration_20260705_165510_add_tools_semantic_entities.down,
    name: '20260705_165510_add_tools_semantic_entities',
  },
  {
    up: migration_20260707_113916_add_audit_collections.up,
    down: migration_20260707_113916_add_audit_collections.down,
    name: '20260707_113916_add_audit_collections',
  },
  {
    up: migration_20260707_152543_add_ai_settings_global.up,
    down: migration_20260707_152543_add_ai_settings_global.down,
    name: '20260707_152543_add_ai_settings_global',
  },
  {
    up: migration_20260707_235442_add_gsc_inspection_fields.up,
    down: migration_20260707_235442_add_gsc_inspection_fields.down,
    name: '20260707_235442_add_gsc_inspection_fields',
  },
  {
    up: migration_20260709_171108_phase8_schema_flags.up,
    down: migration_20260709_171108_phase8_schema_flags.down,
    name: '20260709_171108_phase8_schema_flags',
  },
  {
    up: migration_20260711_184910.up,
    down: migration_20260711_184910.down,
    name: '20260711_184910'
  },
  {
    up: migration_20261008_190423_add_reset_password_requested_at.up,
    down: migration_20261008_190423_add_reset_password_requested_at.down,
    name: '20261008_190423_add_reset_password_requested_at',
  },
  {
    up: migration_20261008_225200_add_media_object_key.up,
    down: migration_20261008_225200_add_media_object_key.down,
    name: '20261008_225200_add_media_object_key',
  },
];
