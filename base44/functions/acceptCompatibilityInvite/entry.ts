import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
Deno.serve(async req=>{
 try{
  const api=createClientFromRequest(req),user=await api.auth.me();
  if(!user)return Response.json({error:'unauthorized'},{status:401});
  const {code,scanId}=await req.json();
  if(typeof code!=='string'||typeof scanId!=='string')return Response.json({error:'invalid_request'},{status:400});
  const found=await api.asServiceRole.entities.Compatibility.filter({invitation_code:code.trim()},{limit:1});
  const c=found.items?.[0];
  if(!c||c.status!=='pending')return Response.json({error:'invalid_invitation'},{status:404});
  if(c.participant_a_id===user.id)return Response.json({error:'same_participant'},{status:403});
  const scan=await api.entities.Scan.get(scanId);
  if(!scan||scan.created_by_id!==user.id||scan.scan_type!=='compatibility'||scan.status!=='analyzed')return Response.json({error:'invalid_scan'},{status:403});
  const updated=await api.asServiceRole.entities.Compatibility.update(c.id,{participant_b_id:user.id,scan_b_id:scanId,consent_b:true,status:'accepted'});
  return Response.json({compatibility:updated});
 }catch(e){console.error(e);return Response.json({error:'accept_failed'},{status:500});}
});