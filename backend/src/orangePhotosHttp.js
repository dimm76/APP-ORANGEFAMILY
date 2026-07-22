const service=require('./orangePhotosService');
function send(res,result,status=200){if(!result.ok)return res.status(result.status||400).json({ok:false,message:result.reason||'Petición no válida.'});return res.status(status).json({ok:true,...result.payload});}
async function multipart(req,maxBytes){const type=String(req.headers['content-type']||''),match=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);if(!match)throw new Error('Content-Type multipart no válido.');const boundary=Buffer.from(`--${match[1]||match[2]}`),chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>maxBytes+128*1024)throw new Error('Archivo demasiado grande.');chunks.push(chunk);}const body=Buffer.concat(chunks),fields={};let file=null,start=0;while(start<body.length){const at=body.indexOf(boundary,start);if(at<0)break;start=at+boundary.length;const next=body.indexOf(boundary,start);if(next<0)break;const part=body.slice(start,next),split=part.indexOf('\r\n\r\n');if(split<0)continue;const headers=part.slice(0,split).toString('utf8'),disp=/content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headers),name=disp&&/name="([^"]+)"/i.exec(disp[1]),filename=disp&&/filename="([^"]*)"/i.exec(disp[1]);if(!name)continue;let content=part.slice(split+4);if(content.subarray(-2).equals(Buffer.from('\r\n')))content=content.slice(0,-2);if(filename){const mime=/content-type:\s*([^\r\n]+)/i.exec(headers);file={buffer:content,filename:filename[1]||'archivo',mimeType:mime?mime[1].trim().toLowerCase():'application/octet-stream'};}else fields[name[1]]=content.toString('utf8');}return{file,fields};}
function safe(handler,message,status=200){return async(req,res)=>{try{return send(res,await handler(req),status);}catch(error){console.error('OrangePhotos',error);return res.status(500).json({ok:false,message});}};}
function handleOrangePhotosRoutes(app){
app.get('/api/orange-photo-members',safe(req=>service.familyMembers(req),'No se pudieron cargar los miembros.'));
app.get('/api/orange-photos',safe(req=>service.list(req),'No se pudo cargar la biblioteca.'));
app.get('/api/orange-photos/:id',safe(req=>service.detail(req,req.params.id,{allowTrash:true}),'No se pudo cargar la foto.'));
app.post('/api/orange-photos',async(req,res)=>{try{if(String(req.headers['content-type']||'').startsWith('multipart/form-data')){const parsed=await multipart(req,service.MAX_VIDEO_BYTES);return send(res,await service.upload(req,parsed.file,parsed.fields),201);}return send(res,await service.createFromExisting(req,req.body||{}),201);}catch(error){console.error('OrangePhotos upload',error);return res.status(400).json({ok:false,message:error.message||'Subida no válida.'});}});
app.patch('/api/orange-photos/:id',safe(req=>service.update(req,req.params.id,req.body||{}),'No se pudo actualizar la foto.'));
app.post('/api/orange-photos/:id/trash',safe(req=>service.trash(req,req.params.id),'No se pudo mover a la papelera.'));
app.post('/api/orange-photos/:id/restore',safe(req=>service.trash(req,req.params.id,true),'No se pudo restaurar la foto.'));
app.get('/api/orange-photos/:id/url',safe(req=>service.signedUrl(req,req.params.id),'No se pudo firmar la URL.'));
app.get('/api/orange-photos/:id/original-url',safe(req=>service.signedUrl(req,req.params.id,true),'No se pudo firmar la URL original.'));
app.post('/api/orange-photos/:id/share',safe(req=>service.share(req,req.params.id,req.body||{}),'No se pudo compartir la foto.'));
app.get('/api/orange-photo-albums',safe(req=>service.albums(req),'No se pudieron cargar los álbumes.'));
app.post('/api/orange-photo-albums',safe(req=>service.createAlbum(req,req.body||{}),'No se pudo crear el álbum.',201));
app.patch('/api/orange-photo-albums/:id',safe(req=>service.updateAlbum(req,req.params.id,req.body||{}),'No se pudo actualizar el álbum.'));
app.post('/api/orange-photo-albums/:id/photos',safe(req=>service.addPhoto(req,req.params.id,req.body||{}),'No se pudo añadir la foto.'));
app.delete('/api/orange-photo-albums/:id/photos/:photoId',safe(req=>service.addPhoto(req,req.params.id,{photo_id:req.params.photoId},true),'No se pudo quitar la foto.'));
app.post('/api/orange-photo-albums/:id/share',safe(req=>service.shareAlbum(req,req.params.id,req.body||{}),'No se pudo compartir el álbum.'));
app.get('/api/orange-photo-tags',safe(req=>service.tags(req),'No se pudieron cargar las etiquetas.'));
app.post('/api/orange-photo-tags',safe(req=>service.createTag(req,req.body||{}),'No se pudo crear la etiqueta.',201));
}
module.exports={handleOrangePhotosRoutes};
