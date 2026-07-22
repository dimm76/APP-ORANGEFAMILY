const BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
async function request(path,options={}){const res=await fetch(`${BASE}${path}`,{credentials:'include',headers:options.body instanceof FormData?options.headers:{'Content-Type':'application/json',...(options.headers||{})},...options});let data;try{data=await res.json();}catch{data=null;}if(!res.ok)throw new Error(data?.message||'No se pudo completar la petición.');return data;}
export function listOrangePhotos(filters={}){const q=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v!==''&&v!=null&&v!==false)q.set(k,String(v));});return request(`/api/orange-photos?${q}`);}
export const getOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}`);
export const updateOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
export const trashOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/trash`,{method:'POST',body:'{}'});
export const restoreOrangePhoto=id=>request(`/api/orange-photos/${encodeURIComponent(id)}/restore`,{method:'POST',body:'{}'});
export const shareOrangePhoto=(id,body)=>request(`/api/orange-photos/${encodeURIComponent(id)}/share`,{method:'POST',body:JSON.stringify(body)});
export async function uploadOrangePhoto(file,metadata={}){const form=new FormData();form.append('file',file);form.append('metadata',JSON.stringify(metadata));return request('/api/orange-photos',{method:'POST',body:form});}
export const listOrangeAlbums=()=>request('/api/orange-photo-albums');
export const createOrangeAlbum=body=>request('/api/orange-photo-albums',{method:'POST',body:JSON.stringify(body)});
export const addPhotoToAlbum=(id,photo_id)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos`,{method:'POST',body:JSON.stringify({photo_id})});
export const removePhotoFromAlbum=(id,photoId)=>request(`/api/orange-photo-albums/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'});
export const listOrangePhotoMembers=()=>request('/api/orange-photo-members');
