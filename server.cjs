const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.md':'text/plain'};
http.createServer((req,res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep) || path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))) { res.writeHead(403).end(); return; }
  fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404).end();return;} res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data); });
}).listen(4173,'127.0.0.1',()=>console.log('Atelier Plan: http://localhost:4173'));
