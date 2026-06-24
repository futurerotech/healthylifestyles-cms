import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Payload's admin bundle pulls in packages that ship raw .node/esm — let Next
  // transpile sharp on the server runtime rather than externalize it.
  serverExternalPackages: ['sharp'],
};

export default withPayload(nextConfig);
