import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { openProject, ValidationError } from './index.js';

const html = (token) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planus Manus</title><style>
body{font:15px system-ui;margin:0;color:#1b2430;background:#f5f7fa}header{padding:14px 20px;background:#172b4d;color:white}main{display:grid;grid-template-columns:minmax(220px,32%) 1fr;min-height:calc(100vh - 52px)}aside,article{padding:18px;overflow:auto}aside{border-right:1px solid #d5dce5}input,textarea,select,button{font:inherit;padding:8px;border:1px solid #aeb9c7;border-radius:5px}button{cursor:pointer;background:#e6edf7}input,textarea{width:95%;margin:4px 0}li{margin:6px 0}.row{margin-left:calc(var(--depth) * 14px)}pre{white-space:pre-wrap;word-break:break-word;background:white;padding:12px;border:1px solid #d5dce5;border-radius:6px}small{color:#556}form{margin:10px 0}h2{margin-top:0}@media(max-width:700px){main{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #d5dce5}}</style></head><body><header><strong>Planus Manus</strong></header><main><aside><label>Search <input id="q" placeholder="Search this project"></label><div id="tree"></div><h3>Planning documents</h3><div id="docs"></div><form id="new"><h3>New ticket</h3><input name="title" placeholder="Title" required><textarea name="description" placeholder="Description"></textarea><button>Create root ticket</button></form></aside><article id="detail"><p>Select a ticket to inspect it.</p></article></main><script>const csrf=${JSON.stringify(token)};
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{'content-type':'application/json','x-pman-csrf':csrf,...opts.headers}});const x=await r.json();if(!r.ok)throw Error(x.error||r.statusText);return x}
let treeOffset=0;async function load(append=false){if(!append){treeOffset=0;document.querySelector('#tree').innerHTML=''}const data=await api('/api/tree?offset='+treeOffset);const html=data.items.map(t=>'<div class="row" style="--depth:'+t.depth+'"><button data-id="'+t.id+'">'+esc(t.title)+' <small>'+esc(t.rollup)+'</small></button></div>').join('');document.querySelector('#tree').insertAdjacentHTML('beforeend',html);treeOffset+=data.items.length;document.querySelectorAll('#tree button[data-id]').forEach(b=>b.onclick=()=>show(b.dataset.id));document.querySelector('#tree-more')?.remove();if(treeOffset<data.total){const more=document.createElement('button');more.id='tree-more';more.textContent='Load more tickets';more.onclick=()=>load(true);document.querySelector('#tree').append(more)}if(!append){const docs=[];for(const kind of ['goals','plans','decisions'])for(const d of await api('/api/documents?kind='+kind))docs.push({...d,kind});document.querySelector('#docs').innerHTML=docs.map(d=>'<p><strong>'+esc(d.kind.slice(0,-1))+':</strong> '+esc(d.title)+'<br><small>'+esc(d.status)+'</small><br>'+esc(d.body).slice(0,180)+'</p>').join('')||'<small>No planning documents yet.</small>'}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function show(id){const t=await api('/api/tickets/'+id);document.querySelector('#detail').innerHTML='<h2>'+esc(t.title)+'</h2><p>Status: '+esc(t.status)+' · Priority: '+esc(t.priority)+'</p><form id="edit"><input name="title" value="'+esc(t.title)+'"><select name="status">'+['todo','in_progress','done','cancelled'].map(s=>'<option '+(s===t.status?'selected':'')+'>'+s+'</option>').join('')+'</select><textarea name="description">'+esc(t.description||'')+'</textarea><button>Save ticket</button></form><button id="context">Show context packet</button><pre id="context-data" hidden></pre><pre>'+esc(t.description||'')+'</pre><h3>Comments</h3><div id="comments"></div><form id="comment"><textarea name="body" placeholder="Add comment"></textarea><button>Add comment</button></form><p><code>'+id+'</code></p>';
 document.querySelector('#context').onclick=async()=>{const box=document.querySelector('#context-data');box.textContent=JSON.stringify(await api('/api/context/'+id),null,2);box.hidden=false};
 document.querySelector('#edit').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/tickets/'+id,{method:'PATCH',body:JSON.stringify(Object.fromEntries(f))});await load();await show(id)};
 const cs=await api('/api/tickets/'+id+'/comments');document.querySelector('#comments').innerHTML=cs.map(c=>'<p><small>'+esc(c.author)+' · '+esc(c.createdAt)+'</small><br>'+esc(c.body)+'</p>').join('')||'<small>No comments yet</small>';
 document.querySelector('#comment').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/tickets/'+id+'/comments',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});await show(id)} }
document.querySelector('#new').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const t=await api('/api/tickets',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.target.reset();await load();show(t.id)};
document.querySelector('#q').oninput=async e=>{if(!e.target.value){load();return}const h=await api('/api/search?q='+encodeURIComponent(e.target.value));document.querySelector('#tree').innerHTML=h.map(t=>'<div><button data-id="'+t.id+'">'+esc(t.title)+' <small>'+esc(t.type)+'</small></button></div>').join('');document.querySelectorAll('#tree button').forEach(b=>b.onclick=()=>show(b.dataset.id))};load();</script></body></html>`;

export async function serve({ cwd = process.cwd(), port = 0, open = false } = {}) {
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
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"}); return res.end(html(token)); }
      if (req.method === 'OPTIONS') return send(res,405,{error:'CORS disabled'});
      if (req.method==='GET'&&url.pathname==='/api/tree'){const offset=Math.max(0,Number(url.searchParams.get('offset')??0)||0),limit=5000,items=await project.tree(null,{limit,offset}),total=(await project.tickets.list({limit:Number.MAX_SAFE_INTEGER})).length;return send(res,200,{items,total,offset,limit});}
      if (req.method==='GET'&&url.pathname==='/api/search')return send(res,200,await project.search(url.searchParams.get('q')));
      let m=/^\/api\/tickets\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.get(m[1]));
      if(m&&req.method==='PATCH')return send(res,200,await project.tickets.update(m[1],await body(req)));
      if(url.pathname==='/api/tickets'&&req.method==='POST')return send(res,201,await project.tickets.create(await body(req)));
      m=/^\/api\/tickets\/([0-9a-f-]+)\/comments$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.comments.list(m[1]));
      if(m&&req.method==='POST')return send(res,201,await project.comments.add(m[1],await body(req)));
      if(url.pathname==='/api/documents'&&req.method==='GET'){const kind=url.searchParams.get('kind');return send(res,200,await project.documents.list(kind));}
      m=/^\/api\/context\/([0-9a-f-]+)$/.exec(url.pathname);if(m&&req.method==='GET')return send(res,200,await project.context(m[1]));
      if(url.pathname==='/api/validate'&&req.method==='GET')return send(res,200,await project.validate());
      return send(res,404,{error:'Not found'});
    } catch(e) { return send(res,e.code==='NOT_FOUND'?404:e.code==='VALIDATION'?400:500,{error:e.message,code:e.code??'ERROR'}); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port},resolve);});
  const address=server.address(), actualPort=address.port, url=`http://127.0.0.1:${actualPort}`; boundPort=actualPort;
  if(open) openBrowser(url);
  return { server, url, project };
}
function safeToken(a,b){if(typeof a!=='string'||a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>1_000_000)throw new ValidationError('Request body is too large');}try{return JSON.parse(data||'{}')}catch{throw new ValidationError('Request body must be JSON');}}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'});res.end(JSON.stringify(value));}
function openBrowser(url){
  const [file,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
