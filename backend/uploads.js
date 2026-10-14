import { ApiError,id,option,fetchJson,supabase } from './api.js';
import { validatedClaims,isMfa } from './admin.js';
const fail=code=>{throw new ApiError(code,400);};
export function inspectFile(bytes,kind){
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>(kind==='image'?4194304:8388608))fail('invalid_file_size');
 const text=new TextDecoder('latin1').decode(bytes.slice(0,32));
 if(kind==='image'){
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9)return {contentType:'image/jpeg',ext:'jpg'};
  if(bytes.length>24&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])){const d=new DataView(bytes.buffer,bytes.byteOffset);const w=d.getUint32(16),h=d.getUint32(20);if(!w||!h||w*h>16000000)fail('image_dimensions_exceeded');return {contentType:'image/png',ext:'png'};}
  if(text.startsWith('RIFF')&&text.slice(8,12)==='WEBP')return {contentType:'image/webp',ext:'webp'};
 }else{
  if(text.startsWith('%PDF-'))return {contentType:'application/pdf',ext:'pdf'};
  if(bytes[0]===80&&bytes[1]===75&&[3,5].includes(bytes[2])&&[4,6].includes(bytes[3]))return {contentType:'application/zip',ext:'zip'};
 }
 fail('unsupported_file_type');
}
export async function scanDocument(bytes,sha256,env,fetcher){
 if(!env.SCANNER_URL||!env.SCANNER_TOKEN)return 'pending';
 let u;try{u=new URL(env.SCANNER_URL);}catch{fail('invalid_scanner_configuration');}
 if(u.protocol!=='https:'||u.username||u.password||u.search)fail('invalid_scanner_configuration');
 const {response,data}=await fetchJson(fetcher,u.href,{method:'POST',headers:{Authorization:`Bearer ${env.SCANNER_TOKEN}`,'Content-Type':'application/octet-stream','X-Content-SHA256':sha256},body:bytes},'scanner_unavailable');
 if(!response.ok||data.sha256!==sha256||!['clean','rejected'].includes(data.verdict))throw new ApiError('scanner_unavailable',503);
 return data.verdict;
}
async function boundedBinary(response){const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8388608){await reader.cancel();fail('invalid_file_size');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
export async function handleUpload({route,b,request,env,fetcher,adminDb,session,requestId}){
 if(request.method!=='POST')throw new ApiError('method_not_allowed',405);
 const actor=session.user?.id;if(!session.user?.email_confirmed_at)throw new ApiError('unauthorized',401);
 const mfa=isMfa(validatedClaims(session.bearer)),permission=route==='admin/scan'?'products':option(b.permission,['products','content','events','settings']);
 const run=(action,p)=>adminDb(action,{...p,permission,request_id:requestId},actor,mfa);
 await run('media',{limit:1});
 let bytes,asset,kind,sha256;
 if(route==='admin/scan'){
  asset=await run('media_detail',{id:id(b.id)});if(!asset||asset.bucket!=='quarantine'||asset.kind!=='document')fail('invalid_media');kind=asset.kind;
  const r=await fetcher(`${supabase(env)}/storage/v1/object/authenticated/quarantine/${asset.storage_path}`,{headers:{Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(15000)});
  if(!r.ok||Number(r.headers.get('Content-Length'))>8388608)throw new ApiError('storage_unavailable',502);bytes=await boundedBinary(r);inspectFile(bytes,kind);
 }else{
  kind=option(b.kind,['image','document']);if(kind==='document'&&permission!=='products')throw new ApiError('forbidden',403);
  if(typeof b.base64!=='string'||b.base64.length>11200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64))fail('invalid_file');
  try{bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));}catch{fail('invalid_file');}
 }
 const type=inspectFile(bytes,kind);sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(asset&&sha256!==asset.sha256)fail('file_integrity_mismatch');
 const scan=kind==='document'?await scanDocument(bytes,sha256,env,fetcher):'clean';
 if(route==='admin/scan'){
  if(scan==='clean'){
   const {response}=await fetchJson(fetcher,`${supabase(env)}/storage/v1/object/move`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({bucketId:'quarantine',sourceKey:asset.storage_path,destinationKey:asset.storage_path,destinationBucket:'digital-products'})},'storage_unavailable');if(!response.ok)throw new ApiError('storage_unavailable',502);
  }
  await run('media_scan',{id:asset.id,scan_status:scan,bucket:scan==='clean'?'digital-products':'quarantine'});return {id:asset.id,path:asset.storage_path,status:scan};
 }
 const mediaId=crypto.randomUUID(),path=`${mediaId}.${type.ext}`,bucket=kind==='image'?'site-media':scan==='clean'?'digital-products':'quarantine';
 const {response}=await fetchJson(fetcher,`${supabase(env)}/storage/v1/object/${bucket}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':type.contentType,'x-upsert':'false'},body:bytes},'storage_unavailable');if(!response.ok)throw new ApiError('storage_unavailable',502);
 await run('media_record',{id:mediaId,path,bucket,kind,content_type:type.contentType,size:bytes.length,sha256,scan_status:scan});
 return {id:mediaId,path,status:scan,...(kind==='image'?{url:`${supabase(env)}/storage/v1/object/public/site-media/${path}`}:{})};
}
