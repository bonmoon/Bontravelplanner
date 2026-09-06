const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const listeners = {};
let cached, network, puts = 0;
const cache = { match: async key => key === './index.html' ? new Response('<html>shell</html>') : cached, put: async () => { puts++; } };
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'), {
  self: { location: {origin:'https://example.test'}, addEventListener:(name,fn)=>listeners[name]=fn },
  caches: {open:async()=>cache}, URL, Response, fetch:async()=>{ if(network instanceof Error) throw network; return network; }
});
async function request(mode='cors') {
  let output;
  listeners.fetch({ request:{method:'GET',url:'https://example.test/assets/cat.png',mode}, respondWith:promise=>output=promise });
  return output;
}
(async()=>{
  cached = new Response('png',{headers:{'content-type':'image/png'}}); network = new Error('offline');
  assert.equal(await (await request()).text(),'png');
  cached = new Response('<html>corrupt cache</html>',{headers:{'content-type':'text/html'}});
  assert.equal((await request()).type,'error');
  network = new Response('replacement',{headers:{'content-type':'image/png'}});
  assert.equal(await (await request()).text(),'replacement'); assert.equal(puts,1);
  cached = undefined; network = new Error('offline');
  assert.equal((await request()).type,'error');
  assert.equal(await (await request('navigate')).text(),'<html>shell</html>');
  console.log('PASS: offline images, poisoned image cache recovery, HTML fallback only for navigation');
})().catch(error=>{console.error(error);process.exitCode=1;});
