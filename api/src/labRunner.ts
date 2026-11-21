/** Sandboxed web-preview host for Code Lab (served from the API origin so
 *  learner code never runs under the main site's origin or CSP). */
import type { Env } from './env';

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title>
<style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style></head><body>
<iframe id="f" sandbox="allow-scripts allow-modals allow-forms allow-popups" title="Your page"></iframe>
<script>
var f=document.getElementById('f');
window.addEventListener('message',function(e){
  var d=e.data;
  if(d&&typeof d.__pjeRender==='string'&&e.source===window.parent){f.srcdoc=d.__pjeRender;return;}
  if(d&&d.__pje&&e.source===f.contentWindow){window.parent.postMessage(d,'*');}
});
window.parent.postMessage({__pjeReady:1},'*');
</script></body></html>`;

export function labRunner(env: Env) {
  const app = (env.APP_URL || 'https://profjero-edupro.pages.dev').replace(/\/$/, '');
  return new Response(PAGE, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'content-security-policy': `default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors ${app} http://localhost:5173 http://localhost:4173 http://localhost:8788`,
      'x-content-type-options': 'nosniff',
    },
  });
}
