const CACHE="journal-v3";
self.addEventListener("install",function(){self.skipWaiting();});
self.addEventListener("activate",function(e){
e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(e){
if(e.request.method!=="GET")return;
if(new URL(e.request.url).origin!==self.location.origin)return;
e.respondWith(fetch(e.request.url,{cache:"no-cache"}).then(function(r){
const c=r.clone();caches.open(CACHE).then(function(x){x.put(e.request,c);});return r;
}).catch(function(){return caches.match(e.request);}));
});
