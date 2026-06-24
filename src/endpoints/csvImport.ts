import type { Endpoint, PayloadRequest } from 'payload';

export const csvImport: Endpoint = {
  path: '/audience/csv-import',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
    }

    const p = req.payload as any;

    try {
      // Fetch the audience global to get CSV file info
      const audience = await p.findGlobal({ slug: 'audience', depth: 1 });
      const csvFile = audience?.csvFile;

      if (!csvFile) {
        return Response.json({ ok: false, message: 'No CSV file uploaded. Upload one in Audience → CSV Import tab.' }, { status: 400 });
      }

      const mediaId = typeof csvFile === 'object' ? csvFile.id : csvFile;
      const emailCol = audience?.csvEmailColumn || 'email';
      const nameCol = audience?.csvNameColumn || '';
      const interestsCol = audience?.csvInterestsColumn || '';

      // Fetch CSV content from media
      const media = await p.findByID({ collection: 'media', id: mediaId, depth: 0 });
      const csvUrl = (media as unknown as Record<string, string>).url;
      if (!csvUrl) {
        return Response.json({ ok: false, message: 'CSV file URL not found.' }, { status: 500 });
      }

      const response = await fetch(csvUrl);
      const csvText = await response.text();

      // Parse CSV (simple line-by-line, handles quoted fields)
      const lines = csvText.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        return Response.json({ ok: false, message: 'CSV must have a header row and at least one data row.' }, { status: 400 });
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const emailIdx = headers.indexOf(emailCol.toLowerCase());
      const nameIdx = nameCol ? headers.indexOf(nameCol.toLowerCase()) : -1;
      const interestsIdx = interestsCol ? headers.indexOf(interestsCol.toLowerCase()) : -1;

      if (emailIdx === -1) {
        return Response.json({ ok: false, message: `Column "${emailCol}" not found in CSV header: ${headers.join(', ')}` }, { status: 400 });
      }

      let imported = 0;
      let duplicates = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Handle quoted fields
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const ch of line) {
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        values.push(current.trim());

        const email = values[emailIdx]?.toLowerCase().trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          failed++;
          errors.push(`Line ${i + 1}: invalid email "${values[emailIdx]}"`);
          continue;
        }

        const name = nameIdx >= 0 ? values[nameIdx]?.trim() || undefined : undefined;
        const rawInterests = interestsIdx >= 0 ? values[interestsIdx]?.trim() || '' : '';
        const interests = rawInterests
          ? rawInterests.split(';').map((s) => s.trim()).filter(Boolean)
          : undefined;

        try {
          await p.create({
            collection: 'subscribers',
            data: {
              email,
              name,
              interests,
              source: 'csv-import',
              subscribedAt: new Date().toISOString(),
            },
          });
          imported++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
            duplicates++;
          } else {
            failed++;
            errors.push(`Line ${i + 1}: ${email} — ${msg}`);
          }
        }
      }

      // Update global with result
      await p.updateGlobal({
        slug: 'audience',
        data: {
          csvImportStatus: 'complete',
          csvImportResult: { imported, duplicates, failed, errors: errors.length > 0 ? errors.slice(0, 20) : undefined },
        },
      });

      return Response.json({
        ok: true,
        imported,
        duplicates,
        failed,
        total: lines.length - 1,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await p.updateGlobal({
        slug: 'audience',
        data: { csvImportStatus: 'failed', csvImportResult: { error: msg } },
      });
      return Response.json({ ok: false, message: msg }, { status: 500 });
    }
  },
};
