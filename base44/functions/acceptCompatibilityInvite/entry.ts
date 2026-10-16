import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
export default async function(req) {
 try{
  const api=createClientFromRequest(req),user=await api.auth.me();
  if(!user)return Response.json({error:'unauthorized'},{status:401});
  const {code,scanId}=await req.json();
  if(typeof code!=='string'||typeof scanId!=='string')return Response.json({error:'invalid_request'},{status:400});
  const found=await api.asServiceRole.entities.Compatibility.filter({invitation_code:code.trim()},{limit:1});
  const c=found.items?.[0];
  if(!c||!['pending','accepted','completed'].includes(c.status))return Response.json({error:'invalid_invitation'},{status:404});
  if(c.participant_b_id===user.id && c.scan_b_id===scanId && ['accepted','completed'].includes(c.status))return Response.json({compatibility:{id:c.id,status:c.status}});
  if(c.status!=='pending')return Response.json({error:'already_accepted'},{status:409});
  if(c.participant_a_id===user.id)return Response.json({error:'same_participant'},{status:403});
  const scan=await api.entities.Scan.get(scanId);
  if(!scan||scan.created_by_id!==user.id||scan.scan_type!=='compatibility'||scan.status!=='analyzed')return Response.json({error:'invalid_scan'},{status:403});
  const scanA=await api.asServiceRole.entities.Scan.get(c.scan_a_id).catch(()=>null);
  if(!scanA||scanA.created_by_id!==c.participant_a_id||scanA.status!=='analyzed')return Response.json({error:'invitation_expired'},{status:410});
  const updated=await api.asServiceRole.entities.Compatibility.update(c.id,{participant_b_id:user.id,scan_b_id:scanId,consent_b:true,status:'accepted'});
  return Response.json({compatibility:{id:updated.id,status:updated.status}});
 }catch(e){console.error(e);return Response.json({error:'accept_failed'},{status:500});}
}