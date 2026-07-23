const BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
function apiError(data,fallback='No se pudo completar la petición.'){const error=new Error(data?.message||fallback);error.code=data?.code||'INTERNAL_ERROR';error.details=data?.details??null;return error;}
async function request(path,options={}){const res=await fetch(`${BASE}${path}`,{credentials:'include',headers:options.body instanceof FormData?options.headers:{'Content-Type':'application/json',...(options.headers||{})},...options});let data;try{data=await res.json();}catch{data=null;}if(!res.ok)throw apiError(data);return data;}
export function listOrangePhotos(filters={}){const q=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(Array.isArray(v)){if(v.length)q.set(k,v.join(','));}else if(v!==''&&v!=null&&v!==false)q.set(k,String(v));});return request(`/api/orange-photos?${q}`);}
export function listOrangePhotosTimeline(filters={}){const q=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(['page','per_page','before'].includes(k))return;if(Array.isArray(v)){if(v.length)q.set(k,v.join(','));}else if(v!==''&&v!=null&&v!==false)q.set(k,String(v));});return request(`/api/orange-photos/timeline?${q}`);}
export function listOrangePhotosAroundDate(date,filters={}){const q=new URLSearchParams({date});Object.entries(filters).forEach(([k,v])=>{if(['page','before'].includes(k))return;if(Array.isArray(v)){if(v.length)q.set(k,v.join(','));}else if(v!==''&&v!=null&&v!==false)q.set(k,String(v));});return request(`/api/orange-photos/around-date?${q}`);}
export const getOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}`);
export const updateOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
export const trashOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/trash`,{method:'POST',body:'{}'});
export const restoreOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});
export const purgeOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{method:'DELETE'});
export const emptyOrangePhotosTrash=()=>request('/api/orange-photos/trash',{method:'DELETE'});
export const shareOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}/share`,{method:'POST',body:JSON.stringify(body)});
export const orangePhotoDownloadUrl=id=>`${BASE}/api/orange-photos/${encodeURIComponent(id)}/download`;
export function uploadOrangePhoto(file,metadata={},options={}){const form=new FormData();form.append('file',file);form.append('metadata',JSON.stringify(metadata));if(options.forceDuplicate)form.append('force_duplicate','true');if(options.posterBlob)form.append('poster',options.posterBlob,'poster.jpg');return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`${BASE}/api/orange-photos`);xhr.withCredentials=true;xhr.upload.onprogress=event=>{if(event.lengthComputable)options.onProgress?.(Math.round(event.loaded/event.total*100));};xhr.onerror=()=>reject(apiError({code:'UPLOAD_INTERRUPTED',message:'La conexión se interrumpió durante la subida.'}));xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data=null;}if(xhr.status<200||xhr.status>=300)return reject(apiError(data));resolve(data);};xhr.send(form);});}
export const checkOrangePhotoUpload=file=>request('/api/orange-photos/uploads/check',{method:'POST',body:JSON.stringify({original_filename:file.name,size_bytes:file.size,mime_type:file.type})});
export const initiateOrangePhotoMultipartUpload=(file,metadata={},options={})=>request('/api/orange-photos/uploads/multipart',{method:'POST',body:JSON.stringify({original_filename:file.name,size_bytes:file.size,mime_type:file.type,metadata,force_possible_duplicate:options.forcePossibleDuplicate===true,force_duplicate:options.forceDuplicate===true})});
export const getOrangePhotoMultipartPartUrls=(uploadId,partNumbers)=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}/parts`,{method:'POST',body:JSON.stringify({part_numbers:partNumbers})});
export const completeOrangePhotoMultipartUpload=(uploadId,parts)=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}/complete`,{method:'POST',body:JSON.stringify({parts})});
export const abortOrangePhotoMultipartUpload=uploadId=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}`,{method:'DELETE'});
export const getOrangePhotoMultipartUpload=uploadId=>request(`/api/orange-photos/uploads/${encodeURIComponent(uploadId)}`);
export const listOrangeAlbums=()=>request('/api/orange-photo-albums');
export const createOrangeAlbum=body=>request('/api/orange-photo-albums',{method:'POST',body:JSON.stringify(body)});
export const addPhotoToAlbum=(id,photo_id)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos`,{method:'POST',body:JSON.stringify({photo_id})});
export const removePhotoFromAlbum=(id,photoId)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'});
export const listOrangePhotoMembers=()=>request('/api/orange-photo-members');
