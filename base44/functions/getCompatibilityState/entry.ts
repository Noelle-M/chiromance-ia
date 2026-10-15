import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
Deno.serve(async req=>{
 try{
  const api=createClientFromRequest(req),user=await api.auth.me();
  if(!user)return Response.json({error:'unauthorized'},{status:401});
  const {compatibilityId}=await req.json();
  const c=await api.asServiceRole.entities.Compatibility.get(compatibilityId);
  if(!c||![c.participant_a_id,c.participant_b_id].includes(user.id))return Response.json({error:'not_participant'},{status:403});
  return Response.json({compatibility:{id:c.id,status:c.status,invitation_code:c.participant_a_id===user.id?c.invitation_code:undefined,result_content:c.status==='completed'?c.result_content:''}});
 }catch(e){console.error(e);return Response.json({error:'state_unavailable'},{status:500});}
});