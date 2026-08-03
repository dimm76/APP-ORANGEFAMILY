const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const dbPath = path.resolve(__dirname, "../db.js");
const wasabiPath = path.resolve(__dirname, "../src/wasabiClient.js");
const originalDb = require.cache[dbPath];
const originalWasabi = require.cache[wasabiPath];
const calls = [];
let currentClient;
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (...args) => { calls.push(args); return { rows: [] }; }, connect: async () => currentClient } };
require.cache[wasabiPath] = { id: wasabiPath, filename: wasabiPath, loaded: true, exports: { getSignedOrangePhotoUrl: async record => `https://signed.test/${record.object_key || "file"}` } };
const guests = require("../src/orangePhotosGuestService.js");
if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
if (originalWasabi) require.cache[wasabiPath] = originalWasabi; else delete require.cache[wasabiPath];

test("createGuestInvitationToken produces a non-empty token", () => { assert.ok(guests.createGuestInvitationToken()); });
test("hashGuestInvitationToken produces a SHA-256 hex digest", () => { assert.match(guests.hashGuestInvitationToken("guest-token"), /^[a-f0-9]{64}$/); });
test("invalid guest album access is rejected before PostgreSQL", async () => { calls.length = 0; const result = await guests.resolveGuestAlbumAccess({ user: { id: "user" } }, "invalid"); assert.equal(result.status, 404); assert.equal(calls.length, 0); });
test("unauthenticated guest access returns 401", async () => { assert.equal((await guests.resolveGuestAlbumAccess({}, "invalid")).status, 401); });

const ownerId="11111111-1111-4111-8111-111111111111", familyId="22222222-2222-4222-8222-222222222222", albumId="33333333-3333-4333-8333-333333333333", userId="44444444-4444-4444-8444-444444444444", invitationId="55555555-5555-4555-8555-555555555555", grantId="66666666-6666-4666-8666-666666666666";
const ownerReq={user:{id:ownerId,families:[{id:familyId,role:"owner"}]}};
function transactionClient({grant=true,failOn=null}={}) { const clientCalls=[]; let count=0; const client={query:async(sql,params)=>{clientCalls.push({sql,params});count+=1;if(failOn&&count===failOn)throw new Error("SQL failure");if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};if(/guest_invitations/.test(sql)&&/SELECT i/.test(sql))return{rows:[{id:invitationId,album_id:albumId,title:"Album",is_archived:false,status:"pending",revoked_at:null,expires_at:new Date(Date.now()+60000),invited_email:"guest@example.com",invited_by_user_id:ownerId,can_view:true,can_contribute:false,can_comment:false}]};if(/orange_photo_albums/.test(sql)&&/SELECT/.test(sql))return{rows:[{id:albumId,title:"Album",family_id:familyId}]};if(/auth_users/.test(sql))return{rows:[{email:"guest@example.com",status:"active"}]};if(/guest_grants/.test(sql)&&/SELECT/.test(sql))return{rows:grant?[{id:grantId,status:"revoked"}]:[]};if(/guest_grants/.test(sql)&&/UPDATE/.test(sql))return{rows:grant?[{id:grantId,user_id:userId}]:[]};return{rows:[]};},release(){client.released=true;}};currentClient=client;return{client,clientCalls};}
function acceptRequest(){return {user:{id:userId}};}

test("accept hace dual-write ACL en el mismo client y conserva el flujo legacy", async()=>{const {client,clientCalls}=transactionClient();const result=await guests.accept(acceptRequest(),"token");assert.equal(result.ok,true);assert.equal(clientCalls[0].sql,"BEGIN");assert.match(clientCalls.find(call=>/orange_photo_album_access/.test(call.sql)).sql,/subject_type,status,invitation_id,created_by_user_id/);const acl=clientCalls.find(call=>/orange_photo_album_access/.test(call.sql));assert.match(acl.sql,/external/);assert.match(acl.sql,/active/);assert.match(acl.sql,/COALESCE/);assert.equal(acl.params[0],albumId);assert.equal(acl.params[1],userId);assert.equal(acl.params[2],invitationId);assert.equal(acl.params[3],ownerId);assert.equal(clientCalls.at(-1).sql,"COMMIT");assert.equal(client.released,true);});
test("error en upsert ACL hace rollback, impide commit y se relanza", async()=>{const {client,clientCalls}=transactionClient({failOn:7});await assert.rejects(()=>guests.accept(acceptRequest(),"token"));assert.equal(clientCalls.some(call=>call.sql==="ROLLBACK"),true);assert.equal(clientCalls.some(call=>call.sql==="COMMIT"),false);assert.equal(client.released,true);});
test("revokeGrant usa conexión, owner en el mismo client, RETURNING user_id y revoca ACL", async()=>{const {client,clientCalls}=transactionClient();const result=await guests.revokeGrant(ownerReq,albumId,grantId);assert.deepEqual(result,{ok:true,payload:{revoked:true}});assert.equal(clientCalls[0].sql,"BEGIN");const legacy=clientCalls.find(call=>/guest_grants/.test(call.sql)&&/UPDATE/.test(call.sql));assert.match(legacy.sql,/RETURNING id,user_id/);const acl=clientCalls.find(call=>/orange_photo_album_access/.test(call.sql));assert.match(acl.sql,/SET status='revoked'/);assert.match(acl.sql,/subject_type='external'/);assert.doesNotMatch(acl.sql,/DELETE/);assert.deepEqual(acl.params,[albumId,userId]);assert.equal(clientCalls.at(-1).sql,"COMMIT");assert.equal(client.released,true);});
test("revokeGrant con grant inexistente hace rollback y conserva el error legacy", async()=>{const {client,clientCalls}=transactionClient({grant:false});const result=await guests.revokeGrant(ownerReq,albumId,grantId);assert.equal(result.code,"GUEST_GRANT_NOT_FOUND");assert.equal(clientCalls.some(call=>call.sql==="ROLLBACK"),true);assert.equal(client.released,true);});
test("error SQL durante revokeGrant hace rollback y release", async()=>{const {client,clientCalls}=transactionClient({failOn:3});await assert.rejects(()=>guests.revokeGrant(ownerReq,albumId,grantId));assert.equal(clientCalls.some(call=>call.sql==="ROLLBACK"),true);assert.equal(client.released,true);});
test("las lecturas guest siguen usando grants legacy y no ACL", async()=>{calls.length=0;await guests.resolveGuestAlbumAccess({user:{id:userId}},albumId);assert.match(calls[0][0],/orange_photo_album_guest_grants/);assert.doesNotMatch(calls[0][0],/orange_photo_album_access/);});
