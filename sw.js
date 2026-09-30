const CACHE="journal-v2";
self.addEventListener("install",function(){self.skipWaiting();});
self.addEventListener("activate",function(e){
e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(e){
if(e.request.method!=="GET")return;
e.respondWith(fetch(e.request).then(function(r){
const c=r.clone();caches.open(CACHE).then(function(x){x.put(e.request,c);});return r;
}).catch(function(){return caches.match(e.request);}));
});
