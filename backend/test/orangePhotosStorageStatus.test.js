/* global require */
const test=require("node:test");
const assert=require("node:assert/strict");
for(const key of ["DB_HOST","DB_PORT","DB_NAME","DB_USER","DB_PASSWORD"])process.env[key]||="test";
process.env.DB_PORT="5432";
const pool=require("../db");
const service=require("../src/orangePhotosService");
const userId="11111111-1111-4111-8111-111111111111",familyId="22222222-2222-4222-8222-222222222222";
const req={user:{id:userId,families:[{id:familyId,role:"member"}]}};
const hash="a".repeat(64);
const valid=(overrides={})=>({client_id:"external:image:1",hash,hash_algorithm:"sha256",size_bytes:123,display_name:"IMG.JPG",...overrides});

test("check-storage-status valida autenticación y cuerpo",async()=>{
  assert.equal((await service.checkStorageStatus({}, {items:[valid()]})).status,401);
  assert.equal((await service.checkStorageStatus(req,{})).status,400);
  assert.equal((await service.checkStorageStatus(req,{items:[]})).status,400);
  assert.equal((await service.checkStorageStatus(req,{items:Array.from({length:201},()=>valid())})).status,400);
  assert.equal((await service.checkStorageStatus(req,{items:[valid({hash:"bad"})]})).status,400);
  assert.equal((await service.checkStorageStatus(req,{items:[valid({size_bytes:-1})]})).status,400);
});

test("check-storage-status devuelve exacta, posible y ausente sin datos privados",async()=>{
  let calls=0;
  pool.query=async(sql,params)=>{calls+=1;assert.match(sql,/p\.family_id=\$1::uuid/);assert.match(sql,/p\.owner_user_id=\$2::uuid/);assert.match(sql,/p\.is_trashed=false/);assert.equal(params[0],familyId);assert.equal(params[1],userId);if(sql.includes("DISTINCT ON"))return{rows:[{checksum_sha256:hash,photo_id:"33333333-3333-4333-8333-333333333333"}]};return{rows:[{normalized_name:"other.jpg",size_bytes:"456"}]};};
  const result=await service.checkStorageStatus(req,{items:[valid(),valid({client_id:"possible",hash:"b".repeat(64),size_bytes:456,display_name:"OTHER.JPG"}),valid({client_id:"missing",hash:"c".repeat(64),display_name:"none.jpg"})]});
  assert.equal(result.payload.items[0].status,"backed_up");
  assert.equal(result.payload.items[1].status,"possible_match");
  assert.equal(result.payload.items[2].status,"not_found");
  assert.equal(calls,2);
  for(const item of result.payload.items)for(const forbidden of ["object_key","bucket","storage_key","url","owner_user_id"])assert.equal(Object.hasOwn(item,forbidden),false);
});
