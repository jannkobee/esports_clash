"""Private, single-run archive worker. Separate CPU/memory budget from live Arena playback."""
import json
import os
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from history_handler import handle

ROOT=Path('/online-data')
ROOT.mkdir(exist_ok=True)
LOCK=threading.Lock()
TOKEN=os.environ['ONLINE_WORKER_TOKEN']

class Handler(BaseHTTPRequestHandler):
    def reply(self,code,body):
        data=json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        if self.path=='/health':return self.reply(200,{'status':'ok','launch_history_schema':1})
        if not self.path.startswith('/history/'):return self.reply(404,{'error':'Not found'})
        return handle(self,'GET',TOKEN,ROOT,{},LOCK)
    def do_POST(self):
        if not self.path.startswith('/history/'):return self.reply(404,{'error':'Not found'})
        try:return handle(self,'POST',TOKEN,ROOT,{},LOCK)
        except (ValueError,KeyError,TypeError):return self.reply(422,{'error':'Invalid archive allocation'})

ThreadingHTTPServer(('0.0.0.0',8102),Handler).serve_forever()
