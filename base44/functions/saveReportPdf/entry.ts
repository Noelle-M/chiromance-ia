import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { scanId, reportId, fileUri } = await req.json();
    if (!scanId || !reportId || (typeof fileUri !== 'string')) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    const scan = await base44.entities.Scan.get(scanId);
    if (!scan || scan.created_by_id !== user.id) return Response.json({ error: 'scan_not_owned' }, { status: 403 });
    const report = await base44.entities.Report.get(reportId);
    if (!report || report.scan_id !== scanId || report.created_by_id !== user.id) {
      return Response.json({ error: 'report_not_owned' }, { status: 403 });
    }
    const rights = await base44.asServiceRole.entities.PlayEntitlement.filter({
      user_id: user.id, product_id: 'chiromancia_rapport_complet', scan_id: scanId, status: 'active',
    });
    if (!(rights.items || []).length) return Response.json({ error: 'purchase_required' }, { status: 402 });
    await base44.asServiceRole.entities.Report.update(reportId, { pdf_file_uri: fileUri });
    return Response.json({ saved: true });
  } catch (error) {
    console.error('saveReportPdf failed', error);
    return Response.json({ error: 'save_failed' }, { status: 500 });
  }
});
