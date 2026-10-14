// Launch the pinned CLI without POSIX shell environment assignments (Windows compatible).
import {spawn} from 'node:child_process';import {mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {existsSync} from 'node:fs';import {homedir} from 'node:os';
await mkdir('.local',{recursive:true});
const configFallback=process.platform!=='win32'&&!process.env.XDG_CONFIG_HOME&&!existsSync(resolve(homedir(),'.config/.wrangler'));
const localConfig=resolve('.local/cloudflare-config');if(configFallback)await mkdir(localConfig+'/.wrangler',{recursive:true});
const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,...(configFallback?{XDG_CONFIG_HOME:localConfig}:{}),WRANGLER_LOG_PATH:resolve('.local/wrangler.log'),WRANGLER_SEND_METRICS:'false'}});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
