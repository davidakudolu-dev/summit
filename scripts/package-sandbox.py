"""Package Pages source deployment and a separate static preview; never deploys."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,zipfile
root=Path(__file__).resolve().parents[1]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent
output.mkdir(parents=True,exist_ok=True)
npm='npm.cmd' if os.name=='nt' else 'npm'
for task in ['build','build:functions','build:static','validate:deployment']:
 subprocess.run([npm,'run',task],cwd=root,check=True)
source_files=['README.md','QA_REPORT.md','package.json','package-lock.json','wrangler.toml','.env.example','backup.env.example','.gitignore','.node-version','index.html','bootstrap.js','stage1.css','stage1.js','stage2.css','stage2.js','stage3.css','stage3.js']
source_dirs=['admin','assets','backend','shared','functions','supabase','scripts','demo','jobs','docs','tests','.github','dist']
files=[root/p for p in source_files]
for directory in source_dirs:
 files.extend(p for p in (root/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
# Only explicit reviewed paths are packaged. Never include .local, .git, node_modules or runtime secrets.
secrets=[value.encode() for name,value in os.environ.items() if name in ['GH_TOKEN','GITHUB_TOKEN','CLOUDFLARE_API_TOKEN','SUPABASE_SERVICE_ROLE_KEY','PAYSTACK_SECRET_KEY','RESEND_API_KEY','APP_SECRET','JOB_SECRET'] and len(value)>=16]
for p in files:
 data=p.read_bytes()
 if any(secret in data for secret in secrets):raise RuntimeError('A private credential was found; packaging blocked')
archives=[(output/'1751_Cloudflare_Pages_Full.zip',[(p,'1751-cloudflare-pages/'+str(p.relative_to(root))) for p in files]),(output/'1751_Cloudflare_Static_Preview.zip',[(p,str(p.relative_to(root/'static-preview'))) for p in (root/'static-preview').rglob('*') if p.is_file()])]
for archive,entries in archives:
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p,name in sorted(entries,key=lambda pair:pair[1]):z.write(p,name)
 with zipfile.ZipFile(archive) as z:
  if z.testzip() is not None:raise RuntimeError('Archive integrity failed')
  names=z.namelist()
  if archive.name.endswith('Pages_Full.zip'):
   for name in ['functions/api/[[path]].js','functions/[[path]].js','dist/_routes.json','backend/api.js','wrangler.toml']:
    if '1751-cloudflare-pages/'+name not in names:raise RuntimeError('Missing full deployment component: '+name)
   if '1751-cloudflare-pages/dist/_worker.js' in names:raise RuntimeError('Mixed Pages deployment modes')
  elif any(name in names for name in ['_routes.json','_worker.js']) or 'index.html' not in names:raise RuntimeError('Invalid static preview structure')
 checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
 archive.with_suffix('.sha256').write_text(checksum+'  '+archive.name+'\n')
 print(json.dumps({'archive':str(archive),'files':len(entries),'bytes':archive.stat().st_size,'sha256':checksum,'deployed':False}))
