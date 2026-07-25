self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("sync",event=>{if(event.tag!=="orangephotos-upload-resume")return;event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>Promise.all(clients.map(client=>client.postMessage({type:"ORANGE_PHOTOS_RESUME_AVAILABLE"})))));});
