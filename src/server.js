import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { openProject, ValidationError } from './index.js';
import { renderAppHtml } from './ui.js';

export async function serve({ cwd = process.cwd(), port = 4000, open = false } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ValidationError('Port must be an integer between 0 and 65535 (0 picks a free port)');
  }
  const project = await openProject({ cwd });
  const token = randomBytes(32).toString('hex');
  let boundPort;
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!host || ![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(host)) return send(res, 403, { error: 'Invalid Host' });
      const url = new URL(req.url, `http://${host}`);
      if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
        const origin=req.headers.origin;
        if (!origin || origin !== `http://${host}` || !safeToken(req.headers['x-pman-csrf'], token)) return send(res,403,{error:'Origin or CSRF validation failed'});
      }
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"}); return res.end(renderAppHtml(token, project.config)); }
      if (req.method === 'OPTIONS') return send(res,405,{error:'CORS disabled'});
      if (req.method==='GET'&&url.pathname==='/api/tree'){const offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',5000,1,5000);const {items,total}=await project.tree(null,{limit,offset,fields:'row',withTotal:true});return send(res,200,{items,total,offset,limit});}
      if (req.method==='GET'&&url.pathname==='/api/search'){const types=(url.searchParams.get('types')||'').split(',').map(x=>x.trim()).filter(Boolean);return send(res,200,await project.searchPage(url.searchParams.get('q'),{offset:intParam(url,'offset',0,0),limit:intParam(url,'limit',20,1,100),types,snapshot:url.searchParams.get('snapshot')||undefined}));}
      let m=/^\/api\/tickets\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.get(m[1]));
      m=/^\/api\/tickets\/([0-9a-f-]+)\/versioned$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.getVersioned(m[1]));
      m=/^\/api\/tickets\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='PATCH'){const input=await body(req);const {expectedRevision,...patch}=input;return send(res,200,await project.tickets.update(m[1],patch,{expectedRevision}));}
      if(url.pathname==='/api/tickets'&&req.method==='POST')return send(res,201,await project.tickets.create(await body(req)));
      m=/^\/api\/tickets\/([0-9a-f-]+)\/comments$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.comments.list(m[1]));
      if(m&&req.method==='POST')return send(res,201,await project.comments.add(m[1],await body(req)));
      if(url.pathname==='/api/documents'&&req.method==='GET'){const kind=url.searchParams.get('kind'),offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',200,1,1000);const all=await project.documents.list(kind,{body:false});return send(res,200,{items:all.slice(offset,offset+limit),total:all.length,offset,limit});}
      m=/^\/api\/documents\/([a-z]+)\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.documents.get(m[1],m[2]));
      m=/^\/api\/context\/([0-9a-f-]+)$/.exec(url.pathname);if(m&&req.method==='GET')return send(res,200,await project.context(m[1]));
      if(url.pathname==='/api/validate'&&req.method==='GET')return send(res,200,await project.validate());
      return send(res,404,{error:'Not found'});
    } catch(e) { return send(res,e.code==='NOT_FOUND'?404:e.code==='VALIDATION'?400:e.code==='CONFLICT'?409:e.code==='CYCLE'||e.code==='OPEN_WORK'||e.code==='STALE_SEARCH'?409:500,{error:e.message,code:e.code??'ERROR'}); }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',error=>{
      if(error.code==='EADDRINUSE'){
        const inUse=new Error(`Port ${port} is already in use at http://127.0.0.1:${port}; no additional pman server was started. Close the existing process or choose another explicit port with --port N.`);
        inUse.code='PORT_IN_USE';
        inUse.cause=error;
        reject(inUse);
        return;
      }
      reject(error);
    });
    server.listen({host:'127.0.0.1',port},resolve);
  });
  const address=server.address(), actualPort=address.port, url=`http://127.0.0.1:${actualPort}`; boundPort=actualPort;
  if(open) openBrowser(url);
  return { server, url, project };
}
function intParam(url,name,fallback,min,max=Number.MAX_SAFE_INTEGER){const raw=url.searchParams.get(name);if(raw===null)return fallback;const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);return n;}
function safeToken(a,b){if(typeof a!=='string'||a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>1_000_000)throw new ValidationError('Request body is too large');}try{return JSON.parse(data||'{}')}catch{throw new ValidationError('Request body must be JSON');}}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'});res.end(JSON.stringify(value));}
function openBrowser(url){
  const [file,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
