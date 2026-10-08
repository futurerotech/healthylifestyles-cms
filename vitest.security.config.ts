import { mergeConfig } from 'vitest/config';
import config from './vitest.config';

// Security checks must not load deployment credentials from dotenv files.
export default mergeConfig(config, { envDir: false });
