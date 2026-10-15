import { permanentRedirect } from "next/navigation";
import { SITE_BASE_URL } from "@/lib/site-config";

/** pSEO is rendered on the public Astro site; the CMS keeps a legacy redirect. */
export default async function PseoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`${SITE_BASE_URL}/tools/pseo/${encodeURIComponent(slug)}`);
}
