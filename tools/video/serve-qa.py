"""Local, memory-only video acceptance harness. No child records or microphone."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/static/styles.css?v=1.8.0"><title>StarPet local video QA</title><body style="padding:28px;max-width:1200px;margin:auto"><main id="qa-root"></main><script type="module">
import {VideoRoom} from '/static/video-room.mjs';
import {prepareLocalVideo} from '/static/video-source.mjs';
import {AUDIO_CLIPS} from '/static/audio-manifest.mjs';
import {BOOKDASH_LESSONS} from '/static/videos/bookdash.mjs';
const state={xp:17,stars:4,videoProgress:{hello:{position:9,seconds:[0,1],correct:['hello-name'],completed:true}}};
let audio;const events=[];
const stop=()=>{if(audio){audio.pause();audio=null}};
const speak=text=>{stop();audio=new Audio(AUDIO_CLIPS[text].path);events.push({speech:text});audio.play().catch(e=>events.push({error:e.message}))};
const room=new VideoRoom({root:document.querySelector('#qa-root'),getState:()=>state,save:()=>{},speak,speakWhilePaused:speak,beforeMedia:stop,practice:()=>events.push({error:'Unexpected microphone path'}),canAct:()=>true,toast:text=>events.push({toast:text}),prepareVideo:prepareLocalVideo});
window.__videoQA={room,state,events,books:BOOKDASH_LESSONS,stop};
document.addEventListener('visibilitychange',()=>{if(document.hidden){room.pause();stop()}});
</script>'''

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'server' / 'app'), **kwargs)
    def do_GET(self):
        if self.path == '/video-qa':
            data = HTML.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(data)))
            self.end_headers(); self.wfile.write(data)
        else:
            super().do_GET()

if __name__ == '__main__':
    print('Memory-only QA: http://127.0.0.1:8768/video-qa', flush=True)
    ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
