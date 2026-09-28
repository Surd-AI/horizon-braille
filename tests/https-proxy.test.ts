import {test,expect,vi} from 'vitest';
import {startLocalServer} from '../apps/api/src/server';
import {request} from 'node:http';
const base={port:0,configured:false,provider:vi.fn()};
test('HTTPS allowlist needs explicit opt-in and rejects noncanonical origins',async()=>{
 await expect(startLocalServer({...base,origins:['https://example.org']})).rejects.toThrow();
 // Synthetic userinfo follows the public repository's sanitized fixture convention.
 const credentialUrl=new URL('https://example.org');credentialUrl.username='synthetic-test';credentialUrl.password='synthetic-test';
 for(const origin of ['https://example.org/',credentialUrl.href.replace(/\/$/,''),'https://*.example.org','https://example.org/a','https://example.org?x=1','http://example.org'])
  await expect(startLocalServer({...base,allowHttpsOrigins:true,origins:[origin]})).rejects.toThrow();
});
test('reverse proxy origin opt-in retains exact Origin and loopback Host checks',async()=>{
 const server=await startLocalServer({...base,allowHttpsOrigins:true,origins:['https://example.org'],segmenter:async texts=>({model:'test',tokens:texts.map(t=>[t])})});
 try {
  const url=`http://127.0.0.1:${server.port}/segment`;
  const init={method:'POST',headers:{origin:'https://example.org','content-type':'application/json'},body:JSON.stringify({source:'中文'})};
  const good=await fetch(url,init);expect(good.status).toBe(200);expect(good.headers.get('access-control-allow-origin')).toBe('https://example.org');
  expect((await fetch(url,{...init,headers:{...init.headers,origin:'https://evil.example'}})).status).toBe(403);
  const status=await new Promise(resolve=>{const req=request(url,{method:'POST',headers:{...init.headers,host:'example.org'}},res=>{res.resume();resolve(res.statusCode);});req.end(init.body);});
  expect(status).toBe(403);
 }finally{await server.close();}
});
