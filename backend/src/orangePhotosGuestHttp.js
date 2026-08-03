const service=require('./orangePhotosGuestService');
function send(res,r){return res.status(r.ok?200:(r.status||400)).json(r.ok?{ok:true,...r.payload}:{ok:false,code:r.code,message:r.reason});}
function safe(fn){return async(req,res)=>{try{return send(res,await fn(req));}catch(e){console.error('Orange guest',{message:e.message});return res.status(500).json({ok:false,code:'INTERNAL_ERROR',message:'No se pudo completar la operación.'});}};}
function handleOrangePhotosGuestRoutes(app){
 app.post('/api/orange-photo-albums/:albumId/guest-invitations',safe(req=>service.createInvitation(req,req.params.albumId,req.body||{})));
 app.get('/api/orange-photo-albums/:albumId/guest-access',safe(req=>service.listAccess(req,req.params.albumId)));
 app.delete('/api/orange-photo-albums/:albumId/guest-invitations/:invitationId',safe(async req=>{const o=await service.listAccess(req,req.params.albumId);if(!o.ok)return o;return service.revokeInvitation(req,req.params.albumId,req.params.invitationId);}));
 app.delete('/api/orange-photo-albums/:albumId/guest-grants/:grantId',safe(async req=>service.revokeGrant(req,req.params.albumId,req.params.grantId)));
 app.get('/api/public/orange-photo-guest-invitations/:token',safe(req=>service.publicInvitation(req.params.token)));
 app.post('/api/orange-photo-guest-invitations/:token/accept',safe(req=>service.accept(req,req.params.token)));
 app.get('/api/guest/orange-photo-albums',safe(req=>service.guestAlbums(req)));
 app.get('/api/guest/orange-photo-albums/:albumId',safe(req=>service.guestAlbum(req,req.params.albumId)));
 app.get('/api/guest/orange-photo-albums/:albumId/photos',safe(req=>service.guestPhotos(req,req.params.albumId,req.query||{})));
}
module.exports={handleOrangePhotosGuestRoutes};
