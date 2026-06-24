import type { Endpoint, PayloadRequest } from 'payload';
import { parseCsv, generateAllPages, type PseoTemplate, type CsvRow } from '../lib/pseo';

/**
 * POST /api/pseo/generate
 *
 * Reads the dataset CSV + template, generates a PseoPage per row.
 * Body: { datasetId, templateId }
 * Auth: admin-only
 */
export const pseoGenerate: Endpoint = {
  path: '/pseo/generate',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ ok: false, count: 0, message: 'Not authenticated.' }, { status: 401 });
    }

    let body: { datasetId?: string; templateId?: string };
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ ok: false, count: 0, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const { datasetId, templateId } = body;
    if (!datasetId || !templateId) {
      return Response.json({ ok: false, count: 0, message: 'datasetId and templateId are required.' }, { status: 400 });
    }

    const payload = req.payload;

    try {
      /* 1. Fetch dataset + template */
      const [dataset, template] = await Promise.all([
        payload.findByID({ collection: 'pseo-datasets', id: datasetId as any, depth: 1 }),
        payload.findByID({ collection: 'pseo-templates', id: templateId as any, depth: 0 }),
      ]);

      if (!dataset?.csvFile) {
        return Response.json({ ok: false, count: 0, message: 'Dataset has no CSV file.' }, { status: 400 });
      }

      /* 2. Download & parse CSV */
      const mediaId = typeof dataset.csvFile === 'object' ? (dataset.csvFile as any).id : dataset.csvFile;
      const media = await payload.findByID({ collection: 'media', id: mediaId as any, depth: 0 });
      if (!media?.url) {
        return Response.json({ ok: false, count: 0, message: 'CSV file not found.' }, { status: 404 });
      }

      const csvRes = await fetch(media.url);
      const csvText = await csvRes.text();
      const { headers, rows } = parseCsv(csvText);

      if (rows.length === 0) {
        return Response.json({ ok: false, count: 0, message: 'CSV has no data rows (need header + at least 1 row).' });
      }

      /* 3. Prepare template config */
      const tpl: PseoTemplate = {
        headlineTemplate: template.headlineTemplate || '',
        subheadlineTemplate: template.subheadlineTemplate,
        bodyTemplate: template.bodyTemplate || '',
        ctaTemplate: template.ctaTemplate,
        ctaLink: template.ctaLink,
        metaTitleTemplate: template.metaTitleTemplate || '',
        metaDescTemplate: template.metaDescTemplate || '',
        h1Template: template.h1Template,
        slugTemplate: template.slugTemplate || '{{keyword|slugify}}',
      };

      /* 4. Generate pages */
      const pages = generateAllPages(tpl, rows);

      /* 5. Create PseoPage docs (batch, best-effort) */
      let created = 0;
      let errors = 0;
      const datasetIdNum = parseInt(String(datasetId), 10);
      const templateIdNum = parseInt(String(templateId), 10);

      for (const page of pages) {
        try {
          const existing = await payload.find({
            collection: 'pseo-pages',
            where: { slug: { equals: page.slug } } as any,
            limit: 1,
            depth: 0,
          });

          const docData: Record<string, unknown> = {
            slug: page.slug,
            template: templateIdNum,
            dataset: datasetIdNum,
            keyword: page.keyword,
            variables: page.variables as any,
            headline: page.headline,
            subheadline: page.subheadline,
            bodyHtml: page.bodyHtml,
            ctaText: page.ctaText,
            ctaUrl: page.ctaUrl,
            status: 'published',
            seo: {
              metaTitle: page.metaTitle,
              metaDescription: page.metaDescription,
            },
          };

          const existingDocs = existing.docs as any[];
          if (existingDocs.length > 0) {
            await payload.update({
              collection: 'pseo-pages',
              id: existingDocs[0].id,
              data: docData as any,
            });
          } else {
            await payload.create({
              collection: 'pseo-pages',
              data: docData as any,
            });
          }
          created++;
        } catch (err) {
          payload.logger?.error?.('pSEO page creation error: ' + (err as Error).message);
          errors++;
        }
      }

      /* 6. Mark dataset as generated */
      await payload.update({
        collection: 'pseo-datasets',
        id: datasetId as any,
        data: {
          status: 'generated',
          columns: headers,
          rowCount: rows.length,
        } as any,
      });

      return Response.json({
        ok: true,
        count: created,
        message: `Generated ${created} pages (${errors} errors, ${rows.length - created - errors} skipped).`,
      });
    } catch (err) {
      const msg = (err as Error).message;
      payload.logger?.error?.('pSEO generation error: ' + msg);
      return Response.json({ ok: false, count: 0, message: msg }, { status: 500 });
    }
  },
};
