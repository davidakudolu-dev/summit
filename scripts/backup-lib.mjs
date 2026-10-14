import {randomBytes,createCipheriv,createDecipheriv,publicEncrypt,privateDecrypt,constants,createHash,createHmac} from 'node:crypto';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function encryptBackup(bundle,publicKey){
 const key=randomBytes(32),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(bundle),'utf8'),cipher.final()]);
 return Buffer.from(JSON.stringify({version:1,algorithm:'AES-256-GCM/RSA-OAEP-SHA256',encrypted_key:publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
export function decryptBackup(envelope,privateKey){
 const e=JSON.parse(Buffer.from(envelope).toString());if(e.version!==1||e.algorithm!=='AES-256-GCM/RSA-OAEP-SHA256')throw new Error('unsupported_backup_format');
 const key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(e.encrypted_key,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.nonce,'base64'));decipher.setAuthTag(Buffer.from(e.tag,'base64'));
 const bundle=JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()]).toString());
 if(bundle.version!==1||!Array.isArray(bundle.files))throw new Error('invalid_backup_manifest');
 for(const f of bundle.files){if(!f.name||f.name.startsWith('/')||f.name.split('/').includes('..')||digest(Buffer.from(f.base64,'base64'))!==f.sha256)throw new Error('backup_integrity_failure');}
 return bundle;
}
export async function s3Request(env,method,key='',body=Buffer.alloc(0),query='',extraHeaders={},fetcher=fetch){
 const endpoint=new URL(env.BACKUP_S3_ENDPOINT);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search)throw new Error('invalid_backup_endpoint');
 const bucket=env.BACKUP_BUCKET;if(!/^[a-z0-9.-]+$/.test(bucket||''))throw new Error('invalid_backup_bucket');
 const uri=`${endpoint.pathname.replace(/\/$/,'')}/${bucket}${key?'/'+key.split('/').map(encodeURIComponent).join('/'):''}`;
 const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=now.slice(0,8),region=env.BACKUP_REGION||'auto';
 const headers={host:endpoint.host,'x-amz-date':now,'x-amz-content-sha256':digest(body),...(env.BACKUP_SESSION_TOKEN?{'x-amz-security-token':env.BACKUP_SESSION_TOKEN}:{}),...extraHeaders};
 const names=Object.keys(headers).sort(),canonicalHeaders=names.map(k=>`${k}:${headers[k].trim()}\n`).join(''),signedHeaders=names.join(';');
 const request=[method,uri,query,canonicalHeaders,signedHeaders,digest(body)].join('\n'),scope=`${day}/${region}/s3/aws4_request`;
 const h=(k,v)=>createHmac('sha256',k).update(v).digest();const signing=h(h(h(h('AWS4'+env.BACKUP_SECRET_ACCESS_KEY,day),region),'s3'),'aws4_request');
 headers.Authorization=`AWS4-HMAC-SHA256 Credential=${env.BACKUP_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${createHmac('sha256',signing).update(`AWS4-HMAC-SHA256\n${now}\n${scope}\n${digest(request)}`).digest('hex')}`;
 return fetcher(endpoint.origin+uri+(query?'?'+query:''),{method,headers,...(['PUT','POST'].includes(method)?{body}:{}),signal:AbortSignal.timeout(120000)});
}
export function assertRestoreTarget(bundle,env){
 if(env.APP_ENV!=='staging'||env.RESTORE_CONFIRMATION!=='ISOLATED STAGING TARGET')throw new Error('isolated_restore_confirmation_required');
 const target=new URL(env.DATABASE_URL),source=bundle.source_database;
 if(target.hostname===source.hostname&&decodeURIComponent(target.pathname.slice(1))===source.database)throw new Error('cannot_restore_over_source');
 if(env.SUPABASE_URL&&new URL(env.SUPABASE_URL).origin===bundle.source_storage)throw new Error('cannot_restore_over_source_storage');
}
