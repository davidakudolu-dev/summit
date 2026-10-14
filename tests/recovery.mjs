// Run after test:concurrency in the same disposable, unpublished PostgreSQL container.
import {spawn} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import assert from 'node:assert/strict';
import {encryptBackup,decryptBackup,digest,assertRestoreTarget} from '../scripts/backup-lib.mjs';
const container=process.env.TEST_PG_CONTAINER||'1751-postgres-tests';
const run=(args,input)=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',container,...args]);const out=[],err=[];p.stdout.on('data',d=>out.push(d));p.stderr.on('data',d=>err.push(d));p.on('error',reject);p.on('close',c=>c?reject(new Error(Buffer.concat(err).toString())):resolve(Buffer.concat(out)));p.stdin.end(input);});
const sql=async(query,database='postgres')=>(await run(['psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-tA'],query)).toString().trim();
const directory=await mkdtemp(join(tmpdir(),'1751-recovery-test-'));
try{
 await sql(`insert into profiles(id,display_name) select id,'RESTORE TEST ONLY' from auth.users on conflict(id) do nothing;select admin_log((select id from auth.users limit 1),'recovery_fixture','tests',null,null,'{}',gen_random_uuid());`);
 const counts=`select json_build_object('users',(select count(*) from auth.users),'profiles',(select count(*) from profiles),'orders',(select count(*) from orders),'payments',(select count(*) from payments),'items',(select count(*) from order_items),'entitlements',(select count(*) from entitlements),'registrations',(select count(*) from registrations),'audit',(select count(*) from admin_audit))`;
 const expected=JSON.parse(await sql(counts));assert.ok(expected.orders>0&&expected.payments>0&&expected.registrations>0&&expected.audit>0);
 const dump=await run(['pg_dump','-U','postgres','--format=custom','--no-owner','--schema=public','--schema=auth','postgres']);
 const asset=Buffer.from('%PDF-1.7\nISOLATED RECOVERY TEST ONLY'),keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const file=(name,bytes)=>({name,sha256:digest(bytes),base64:bytes.toString('base64')});
 const bundle={version:1,source_database:{hostname:'source.test',database:'postgres'},source_storage:'https://source.example.test',files:[file('database.dump',dump),file('storage/digital-products/test.pdf',asset)]};
 const encrypted=encryptBackup(bundle,keys.publicKey),trustedHash=digest(encrypted);assert.ok(!encrypted.toString().includes('RESTORE TEST ONLY'));await writeFile(join(directory,'backup.enc'),encrypted,{mode:0o600});
 const loaded=await readFile(join(directory,'backup.enc'));assert.equal(digest(loaded),trustedHash);const recovered=decryptBackup(loaded,keys.privateKey);
 assertRestoreTarget(recovered,{APP_ENV:'staging',RESTORE_CONFIRMATION:'ISOLATED STAGING TARGET',DATABASE_URL:'postgres://postgres@isolated.test/1751_restore_test'});
 await sql('drop database if exists "1751_restore_test";create database "1751_restore_test"');
 await run(['pg_restore','-U','postgres','--dbname=1751_restore_test','--clean','--if-exists','--single-transaction','--exit-on-error','--no-owner'],Buffer.from(recovered.files[0].base64,'base64'));
 assert.deepEqual(JSON.parse(await sql(counts,'1751_restore_test')),expected);
 await assert.rejects(()=>sql("set role authenticated;select * from orders",'1751_restore_test'),/permission denied/);
 await assert.rejects(()=>sql("set role authenticated;select platform_admin('overview','{}',null,true)",'1751_restore_test'),/permission denied/);
 assert.equal(await sql("set role service_role;select platform('products','{}',null)->0->>'title'",'1751_restore_test'),'SET\nCONCURRENCY TEST ONLY');
 assert.equal(await sql('select count(*) from entitlements e join orders o on o.id=e.order_id join payments p on p.order_id=o.id where o.status=\'paid\'','1751_restore_test'),'1');
 await writeFile(join(directory,'test.pdf'),Buffer.from(recovered.files[1].base64,'base64'));assert.deepEqual(await readFile(join(directory,'test.pdf')),asset);
 console.log('PASS encrypted PostgreSQL 17 dump restored to a separate staging database: users, profiles, orders, payments, items, entitlements, registrations and immutable audit counts match; paid relationships and fixture file bytes verified.');
}finally{await rm(directory,{recursive:true,force:true});}
