"""Package Pages source deployment and a separate static preview; never deploys."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,zipfile
root=Path(__file__).resolve().parents[1]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent
output.mkdir(parents=True,exist_ok=True)
npm='npm.cmd' if os.name=='nt' else 'npm'
for task in ['build','build:functions','build:static','validate:deployment']:
 subprocess.run([npm,'run',task],cwd=root,check=True)
source_files=['README.md','QA_REPORT.md','package.json','package-lock.json','wrangler.toml','.env.example','backup.env.example','.gitignore','.node-version','index.html','reference.css','reference.js','bootstrap.js','stage1.css','stage1.js','stage2.css','stage2.js','stage3.css','stage3.js']
source_dirs=['admin','assets','backend','shared','functions','supabase','scripts','demo','jobs','docs','tests','.github','dist']
files=[root/p for p in source_files]
for directory in source_dirs:
 files.extend(p for p in (root/directory).rglob('*') if p.is_file() and not any(part in {'.local','.wrangler','.git','node_modules','__pycache__'} for part in p.relative_to(root).parts))
# Only explicit reviewed paths are packaged. Never include .local, .git, node_modules or runtime secrets.
secrets=[value.encode() for name,value in os.environ.items() if name in ['GH_TOKEN','GITHUB_TOKEN','CLOUDFLARE_API_TOKEN','SUPABASE_SERVICE_ROLE_KEY','PAYSTACK_SECRET_KEY','RESEND_API_KEY','APP_SECRET','JOB_SECRET'] and len(value)>=16]
for p in files:
 data=p.read_bytes()
 if any(secret in data for secret in secrets):raise RuntimeError('A private credential was found; packaging blocked')
archives=[('full',output/'1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip',[(p,'1751-cloudflare-pages/'+str(p.relative_to(root))) for p in files]),('static',output/'1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip',[(p,str(p.relative_to(root/'static-preview'))) for p in (root/'static-preview').rglob('*') if p.is_file()])]
for mode,archive,entries in archives:
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p,name in sorted(entries,key=lambda pair:pair[1]):z.write(p,name)
 with zipfile.ZipFile(archive) as z:
  if z.testzip() is not None:raise RuntimeError('Archive integrity failed')
  names=z.namelist()
  if mode=='full':
   for name in ['functions/api/[[path]].js','functions/[[path]].js','dist/_routes.json','backend/api.js','wrangler.toml']:
    if '1751-cloudflare-pages/'+name not in names:raise RuntimeError('Missing full deployment component: '+name)
   if '1751-cloudflare-pages/dist/_worker.js' in names:raise RuntimeError('Mixed Pages deployment modes')
  else:
   forbidden=['wrangler.toml','wrangler.json','wrangler.jsonc','package.json','package-lock.json','_routes.json','_worker.js','.env','.dev.vars']
   if any(Path(name).name in forbidden or any(part.startswith('.') for part in Path(name).parts) or name.startswith(('functions/','backend/','supabase/','scripts/','node_modules/')) for name in names) or 'index.html' not in names:raise RuntimeError('Configuration or server files in static preview')
   for p,name in entries:
    if any(secret in p.read_bytes() for secret in secrets):raise RuntimeError('A private credential was found in preview assets')
 checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
 archive.with_suffix('.sha256').write_text(checksum+'  '+archive.name+'\n')
 print(json.dumps({'archive':str(archive),'files':len(entries),'bytes':archive.stat().st_size,'sha256':checksum,'deployed':False}))
