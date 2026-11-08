import {createServer} from 'node:http';
import {attachWorldLive} from './worldLiveServer.mjs';
const server=createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({service:'hexatrick-world-live'}));});
attachWorldLive(server);server.listen(4176,'0.0.0.0');
