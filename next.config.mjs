import { withPayload } from '@payloadcms/next/withPayload';
import { stagingRobotsHeaders } from './src/lib/staging-crawl.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Payload's admin bundle pulls in packages that ship raw .node/esm — let Next
  // transpile sharp on the server runtime rather than externalize it.
  serverExternalPackages: ['sharp'],
  // Isolated staging only: noindex every response. Production gets no entry.
  async headers() {
    return stagingRobotsHeaders(process.env);
  },
};

export default withPayload(nextConfig);
