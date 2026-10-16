import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
export default async function(req) {
 try {
  const api=createClientFromRequest(req), user=await api.auth.me();
  if(!user) return Response.json({error:'unauthorized'},{status:401});
  const {scanId}=await req.json();
  const scan=await api.entities.Scan.get(scanId);
  if(!scan || scan.created_by_id!==user.id || scan.scan_type!=='compatibility' || scan.status!=='analyzed') return Response.json({error:'invalid_scan'},{status:403});
  const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const compat=await api.asServiceRole.entities.Compatibility.create({participant_a_id:user.id,scan_a_id:scanId,invitation_code:code,status:'pending',consent_a:true,consent_b:false});
  return Response.json({compatibility:compat});
 }catch(e){console.error(e);return Response.json({error:'invitation_failed'},{status:500});}
}