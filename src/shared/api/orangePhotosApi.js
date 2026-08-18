const BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
function apiError(data,fallback='No se pudo completar la petición.'){const error=new Error(data?.message||fallback);error.code=data?.code||'INTERNAL_ERROR';error.details=data?.details??null;return error;}
async function request(path,options={}){const {signal,...requestOptions}=options,res=await fetch(`${BASE}${path}`,{credentials:'include',headers:options.body instanceof FormData?options.headers:{'Content-Type':'application/json',...(options.headers||{})},...requestOptions,signal});let data;try{data=await res.json();}catch{data=null;}if(!res.ok)throw apiError(data);return data;}
const LEGACY_FILTERS=new Set(["media_types","media_type_mode","visibilities","visibility_mode"]);
function photoQuery(filters={},excluded=[]){const q=new URLSearchParams(),skip=new Set(excluded);Object.entries(filters).forEach(([k,v])=>{if(skip.has(k)||LEGACY_FILTERS.has(k)||v==="all")return;if(Array.isArray(v)){if(v.length)q.set(k,v.join(","));}else if(v!==""&&v!=null&&v!==false)q.set(k,String(v));});return q;}
export function listOrangePhotos(filters={},options={}){return request(`/api/orange-photos?${photoQuery(filters)}`,{signal:options.signal});}
export function listOrangePhotosTimeline(filters={},options={}){return request(`/api/orange-photos/timeline?${photoQuery(filters,["page","per_page","before"])}`,{signal:options.signal});}
export function listOrangePhotosAroundDate(date, filters = {}, options = {}) {
  const q = photoQuery(filters, ["page", "before"]);
  q.set("date", date);
  if (options.direction) q.set("direction", options.direction);
  return request(`/api/orange-photos/around-date?${q}`, { signal: options.signal });
}
export const getOrangePhoto=(id,options={})=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{signal:options.signal});
export async function generateOrangePhotoPoster(id,replaceExisting=false,options={}){const controller=options.signal?null:new AbortController(),timeout=controller?window.setTimeout(()=>controller.abort(),180000):null;try{return await request(`/api/orange-photos/${encodeURIComponent(id)}/poster`,{method:'POST',body:JSON.stringify({replace_existing:replaceExisting}),signal:options.signal||controller.signal});}catch(error){if(error.name==="AbortError")throw new Error("La generación está tardando demasiado. Comprueba el estado dentro de unos minutos o vuelve a intentarlo.",{cause:error});throw error;}finally{if(timeout)window.clearTimeout(timeout);}}
export function getOrangePhotoEvents(photoId,options={}){return request(`/api/orange-photos/${encodeURIComponent(photoId)}/events`,{signal:options.signal});}
export const updateOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
export const trashOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/trash`,{method:'POST',body:'{}'});
export const restoreOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});
export const purgeOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{method:'DELETE'});
export const emptyOrangePhotosTrash=()=>request('/api/orange-photos/trash',{method:'DELETE'});
export const shareOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}/share`,{method:'POST',body:JSON.stringify(body)});
export const addOrangePhotoToLibrary = id =>
  request(`/api/orange-photos/${encodeURIComponent(id)}/library`, {
    method: "POST",
    body: "{}",
  });
export const createOrangePhotoPublicLink=(id,regenerate=false)=>request(`/api/orange-photos/${encodeURIComponent(id)}/public-link`,{method:'POST',body:JSON.stringify({regenerate})});
export const revokeOrangePhotoPublicLink=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/public-link`,{method:'DELETE'});
export const orangePhotoDownloadUrl=id=>`${BASE}/api/orange-photos/${encodeURIComponent(id)}/download`;
export async function downloadOrangePhotosZip(photoIds) {
  const response = await fetch(`${BASE}/api/orange-photos/download`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_ids: photoIds }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw apiError(data, "No se pudo preparar la descarga.");
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("La descarga generada está vacía.");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `orange-photos-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}export function uploadOrangePhoto(file,metadata={},options={}){const form=new FormData();form.append('file',file);form.append('metadata',JSON.stringify(metadata));if(options.forceDuplicate)form.append('force_duplicate','true');if(options.posterBlob)form.append('poster',options.posterBlob,'poster.jpg');return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`${BASE}/api/orange-photos`);xhr.withCredentials=true;xhr.upload.onprogress=event=>{if(event.lengthComputable)options.onProgress?.(Math.round(event.loaded/event.total*100));};xhr.onerror=()=>reject(apiError({code:'UPLOAD_INTERRUPTED',message:'La conexión se interrumpió durante la subida.'}));xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data=null;}if(xhr.status<200||xhr.status>=300)return reject(apiError(data));resolve(data);};xhr.send(form);});}
export function uploadOrangePhotoDirect(file,metadata={},options={}){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`${BASE}/api/orange-photos/uploads/direct`);xhr.withCredentials=true;xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-Orange-Filename',encodeURIComponent(file.name));xhr.setRequestHeader('X-Orange-Mime-Type',file.type);xhr.setRequestHeader('X-Orange-File-Size',String(file.size));xhr.setRequestHeader('X-Orange-Force-Duplicate',options.forceDuplicate?'true':'false');xhr.setRequestHeader('X-Orange-Metadata',encodeURIComponent(JSON.stringify(metadata||{})));options.registerAbort?.(()=>xhr.abort());xhr.upload.onprogress=event=>{if(event.lengthComputable)options.onProgress?.({progress:Math.min(95,Math.round(event.loaded/event.total*95)),sentBytes:event.loaded,stage:'uploading'});};xhr.upload.onload=()=>options.onProgress?.({progress:96,sentBytes:file.size,stage:'storing'});xhr.onerror=()=>reject(apiError({code:'UPLOAD_INTERRUPTED',message:'La conexión se interrumpió durante la subida.'}));xhr.onabort=()=>reject(apiError({code:'UPLOAD_INTERRUPTED',message:'La conexión se interrumpió durante la subida.'}));xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data=null;}if(xhr.status<200||xhr.status>=300)return reject(apiError(data));resolve(data);};xhr.send(file);});}
export const checkOrangePhotoUpload=file=>request('/api/orange-photos/uploads/check',{method:'POST',body:JSON.stringify({original_filename:file.name,size_bytes:file.size,mime_type:file.type})});
export const initiateOrangePhotoMultipartUpload=(file,metadata={},options={})=>request('/api/orange-photos/uploads/multipart',{method:'POST',body:JSON.stringify({original_filename:file.name,size_bytes:file.size,mime_type:file.type,metadata,client_upload_key:options.clientUploadKey,force_possible_duplicate:options.forcePossibleDuplicate===true,force_duplicate:options.forceDuplicate===true})});
export const listActiveOrangePhotoUploads=()=>request('/api/orange-photos/uploads');
export const getOrangePhotoMultipartPartUrls=(uploadId,partNumbers)=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}/parts`,{method:'POST',body:JSON.stringify({part_numbers:partNumbers})});
export const completeOrangePhotoMultipartUpload=(uploadId,parts)=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}/complete`,{method:'POST',body:JSON.stringify({parts})});
export const abortOrangePhotoMultipartUpload=uploadId=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}`,{method:'DELETE'});
export const getOrangePhotoMultipartUpload=uploadId=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}`);
export function uploadOrangePhotoMultipartPart(url,blob,{signal,onProgress}={}){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest(),interrupted=()=>apiError({code:'UPLOAD_INTERRUPTED',message:'La conexión se interrumpió durante la subida.'});xhr.open('PUT',url);xhr.timeout=180000;xhr.withCredentials=false;xhr.upload.onprogress=event=>onProgress?.(event.loaded);xhr.onerror=()=>reject(interrupted());xhr.ontimeout=()=>reject(interrupted());xhr.onabort=()=>reject(interrupted());xhr.onload=()=>{if(xhr.status<200||xhr.status>=300){const error=apiError({code:'STORAGE_UPLOAD_FAILED',message:'No se pudo transferir una parte al almacenamiento.'});error.status=xhr.status;return reject(error);}const etag=xhr.getResponseHeader('ETag');if(!etag)return reject(apiError({code:'STORAGE_UPLOAD_FAILED',message:'El almacenamiento no devolvió el ETag de la parte.'}));resolve({etag});};if(signal){if(signal.aborted)return xhr.abort();signal.addEventListener('abort',()=>xhr.abort(),{once:true});}xhr.send(blob);});}
export const listOrangeAlbums=(options={})=>request('/api/orange-photo-albums',{signal:options.signal});
export function listOrangeAlbumPhotos(albumId,options={}){return listOrangePhotos({album_id:albumId,page:options.page||1,per_page:options.perPage||100},{signal:options.signal});}
export function listOrangePhotoVideos(options = {}) {
  return listOrangePhotos({ media_type: "video", page: options.page || 1, per_page: options.perPage || 100, search: String(options.search || "").trim() }, { signal: options.signal });
}
export const listOrangeAlbumPhotoIds=id=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photo-ids`);
export const createOrangeAlbum=body=>request('/api/orange-photo-albums',{method:'POST',body:JSON.stringify(body)});
export const updateOrangeAlbum=(id,body)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
export const shareOrangeAlbum=(id,body)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/share`,{method:'POST',body:JSON.stringify(body)});
export const createOrangeAlbumPublicLink=(id,regenerate=false)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/public-link`,{method:'POST',body:JSON.stringify({regenerate})}).then(response=>{window.dispatchEvent(new CustomEvent("orangephotos:album-public-link",{detail:{id,publicLink:response.public_link}}));return response;});
export const revokeOrangeAlbumPublicLink=id=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/public-link`,{method:'DELETE'}).then(response=>{window.dispatchEvent(new CustomEvent("orangephotos:album-public-link",{detail:{id,publicLink:response.public_link}}));return response;});
export const getPublicOrangePhoto=(token,options={})=>request(`/api/public/orangephotos/photo/${encodeURIComponent(token)}`,{signal:options.signal});
export const getPublicOrangeAlbum=(token,options={})=>request(`/api/public/orangephotos/album/${encodeURIComponent(token)}`,{signal:options.signal});
export const getPublicOrangeAlbumPhotos=(token,filters={},options={})=>request(`/api/public/orangephotos/album/${encodeURIComponent(token)}/photos?${photoQuery(filters)}`,{signal:options.signal});
export const publicOrangePhotoDownloadUrl=token=>`${BASE}/api/public/orangephotos/photo/${encodeURIComponent(token)}/download`;
export const publicOrangeAlbumPhotoDownloadUrl=(token,photoId)=>`${BASE}/api/public/orangephotos/album/${encodeURIComponent(token)}/photos/${encodeURIComponent(photoId)}/download`;
export function downloadPublicOrangeAlbumZip(token,photoIds,onError){const frame=document.createElement('iframe'),form=document.createElement('form'),input=document.createElement('input'),name=`orange-public-download-${Date.now()}`;frame.hidden=true;frame.name=name;form.hidden=true;form.method='POST';form.action=`${BASE}/api/public/orangephotos/album/${encodeURIComponent(token)}/download`;form.target=name;input.type='hidden';input.name='photo_ids';input.value=JSON.stringify(photoIds);form.append(input);document.body.append(frame,form);frame.addEventListener('load',()=>{try{const content=frame.contentDocument?.body?.textContent?.trim();if(content){const data=JSON.parse(content);if(data?.ok===false)onError?.(apiError(data));}}catch(error){void error;}finally{frame.remove();form.remove();}});form.submit();setTimeout(()=>{frame.remove();form.remove();},30000);}
export const deleteOrangeAlbum=id=>updateOrangeAlbum(id,{is_archived:true});
export const listOrangeAlbumCategories=(options={})=>request("/api/orange-photo-album-categories",{signal:options.signal});
export const createOrangeAlbumCategory=body=>request("/api/orange-photo-album-categories",{method:"POST",body:JSON.stringify(body)});
export const updateOrangeAlbumCategory=(id,body)=>request(`/api/orange-photo-album-categories/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(body)});
export const deleteOrangeAlbumCategory=id=>request(`/api/orange-photo-album-categories/${encodeURIComponent(id)}`,{method:"DELETE"});
export const setOrangeAlbumCategories=(id,categoryIds)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/categories`,{method:"PUT",body:JSON.stringify({category_ids:categoryIds})});
export const addPhotoToAlbum=(id,photo_id)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos`,{method:'POST',body:JSON.stringify({photo_id})});
export const removePhotoFromAlbum=(id,photoId)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'});
export const listOrangePhotoMembers=()=>request('/api/orange-photo-members');
