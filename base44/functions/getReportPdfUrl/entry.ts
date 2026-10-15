import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { scanId, reportId } = await req.json().catch(() => ({}));
    if (typeof scanId !== 'string' || typeof reportId !== 'string') return Response.json({ error: 'invalid_request' }, { status: 400 });
    const scan = await base44.entities.Scan.get(scanId);
    const report = await base44.entities.Report.get(reportId);
    if (!scan || scan.created_by_id !== user.id || !report || report.scan_id !== scanId || report.created_by_id !== user.id) return Response.json({ error: 'report_not_owned' }, { status: 403 });
    const rights = await base44.asServiceRole.entities.PlayEntitlement.filter({ user_id: user.id, product_id: 'chiromancia_rapport_complet', scan_id: scanId, status: 'active' });
    if (!(rights.items || []).length) return Response.json({ error: 'purchase_required' }, { status: 402 });
    if (!report.pdf_file_uri) return Response.json({ error: 'pdf_not_ready' }, { status: 404 });
    const result = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: report.pdf_file_uri, expires_in: 600 });
    return Response.json({ url: result.signed_url });
  } catch (error) {
    console.error('getReportPdfUrl failed', error);
    return Response.json({ error: 'pdf_unavailable' }, { status: 500 });
  }
});
