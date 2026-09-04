const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const ALBUM_ID = "33333333-3333-4333-8333-333333333333";

function ownerReq(query = {}) {
  return {
    user: {
      id: USER_ID,
      families: [
        {
          id: FAMILY_ID,
          role: "owner",
          module_access: {
            orange_photos: true,
          },
        },
      ],
    },
    query,
  };
}

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim().toLowerCase();
}

const calls = [];
const dbMock = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (normalizeSql(sql).includes("has_newer") && normalizeSql(sql).includes("has_older")) {
      return { rows: [{ has_newer: false, has_older: false }] };
    }
    return { rows: [] };
  },
};
const dbPath = path.resolve(__dirname, "../db.js");
const wasabiPath = path.resolve(__dirname, "../src/wasabiClient.js");
const originalDb = require.cache[dbPath];
const originalWasabi = require.cache[wasabiPath];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock };
require.cache[wasabiPath] = {
  id: wasabiPath,
  filename: wasabiPath,
  loaded: true,
  exports: {
    getSignedOrangePhotoUrl: async () => "https://signed.test/file",
  },
};
const orangePhotosService = require("../src/orangePhotosService.js");
if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
if (originalWasabi) require.cache[wasabiPath] = originalWasabi; else delete require.cache[wasabiPath];

function resetCalls() {
  calls.length = 0;
}

function listingSql() {
  const call = calls.find(({ sql }) => normalizeSql(sql).startsWith("select p.*"));
  assert.ok(call, "No se encontró la consulta principal del listado.");
  return normalizeSql(call.sql);
}

function assertResult(result) {
  assert.equal(result.ok, true);
}

function galleryQuery(extra = {}) {
  return {
    access_sources: "owned,library",
    access_sources_mode: "include",
    include_total: "false",
    ...extra,
  };
}

test("list uses the logical-copy runtime", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq(galleryQuery()));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /li\.title _copy_title/);
  assert.match(sql, /li\._access_source _copy_access_source/);
  assert.match(sql, /order by li\.captured_at desc nulls last,p\.created_at desc,p\.id desc/);
});

test("owned and library preserve ownLibraryFastPath", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq(galleryQuery()));
  const sql = listingSql();
  assert.match(sql, /join lateral/);
  assert.match(sql, /select candidate\.\*/);
  assert.match(sql, /case when p\.owner_user_id=\$2::uuid then 'owned' else 'library' end _access_source/);
  assert.match(sql, /from public\.orange_photo_library_items candidate where candidate\.photo_id=p\.id and candidate\.user_id=\$2::uuid and candidate\.is_trashed=false/);
});

test("library alone uses ownLibraryFastPath", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    access_sources: "library",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /join lateral/);
  assert.match(sql, /from public\.orange_photo_library_items candidate where candidate\.photo_id=p\.id and candidate\.user_id=\$2::uuid and candidate\.is_trashed=false/);
  assert.match(sql, /case when p\.owner_user_id=\$2::uuid then 'owned' else 'library' end _access_source/);
  assert.match(sql, /li\._access_source='library'/);
  assert.doesNotMatch(sql, /logical_direct_share/);
  assert.doesNotMatch(sql, /logical_album_item/);
});

test("owned alone uses ownLibraryFastPath", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    access_sources: "owned",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /join lateral/);
  assert.match(sql, /from public\.orange_photo_library_items candidate where candidate\.photo_id=p\.id and candidate\.user_id=\$2::uuid and candidate\.is_trashed=false/);
  assert.match(sql, /li\._access_source='owned'/);
  assert.doesNotMatch(sql, /logical_direct_share/);
  assert.doesNotMatch(sql, /logical_album_item/);
});

test("include_total false avoids the count query", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq(galleryQuery()));
  assert.equal(calls.length, 1);
  assert.equal(calls.some(({ sql }) => normalizeSql(sql).includes("select count(*)::int total")), false);
});

test("shared with me preserves sharedWithMeFastPath", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    library_scope: "shared_with_me",
    access_sources: "direct,album",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /select distinct on \(shared_candidate\.photo_id\)/);
  assert.match(sql, /'direct'::text _access_source/);
  assert.match(sql, /'album'::text _access_source/);
  assert.match(sql, /union all/);
  assert.doesNotMatch(sql, /from public\.orange_photo_library_items candidate where candidate\.photo_id=p\.id and candidate\.user_id=\$2::uuid and candidate\.is_trashed=false/);
});

test("shared with me excludes hidden items by default", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq({
    library_scope: "shared_with_me",
    access_sources: "direct,album",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assert.match(listingSql(), /coalesce\(us\.is_hidden,false\)=false/);
});

test("shared with me include_hidden removes the hidden exclusion", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq({
    library_scope: "shared_with_me",
    access_sources: "direct,album",
    access_sources_mode: "include",
    include_hidden: "true",
    include_total: "false",
  }));
  const sql = listingSql();
  assert.doesNotMatch(sql, /coalesce\(us\.is_hidden,false\)=false/);
  assert.match(sql, /coalesce\(us\.is_hidden,false\) is_hidden/);
});

test("shared with me exclude_in_library excludes an active own copy", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq({
    library_scope: "shared_with_me",
    access_sources: "direct,album",
    access_sources_mode: "include",
    exclude_in_library: "true",
    include_total: "false",
  }));
  const sql = listingSql();
  assert.match(sql, /not exists\(select 1 from public\.orange_photo_library_items own_li where own_li\.photo_id=p\.id and own_li\.user_id=\$2::uuid and own_li\.is_trashed=false\)/);
});

test("album context resolves content through source_user_id", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    album_id: ALBUM_ID,
    access_sources: "owned,library",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /public\.orange_photo_album_items selected_album_item/);
  assert.match(sql, /candidate\.user_id=selected_album_item\.source_user_id/);
  assert.match(sql, /selected_album_item\.photo_id=p\.id/);
  assert.match(sql, /'owned'/);
  assert.match(sql, /'library'/);
  assert.match(sql, /'album'/);
  assert.ok(calls.some(({ params }) => params?.includes(ALBUM_ID)));
});

test("album context does not use the general gallery fast paths", async () => {
  resetCalls();
  await orangePhotosService.list(ownerReq({
    album_id: ALBUM_ID,
    access_sources: "owned,library",
    access_sources_mode: "include",
    include_total: "false",
  }));
  const sql = listingSql();
  assert.match(sql, /selected_album_item/);
  assert.doesNotMatch(sql, /select candidate\.\* from public\.orange_photo_library_items candidate where candidate\.photo_id=p\.id and candidate\.user_id=\$2::uuid and candidate\.is_trashed=false/);
  assert.doesNotMatch(sql, /select distinct on \(shared_candidate\.photo_id\)/);
});

test("timeline preserves the shared-with-me query contract", async () => {
  resetCalls();
  const result = await orangePhotosService.timeline(ownerReq({
    library_scope: "shared_with_me",
    access_sources: "direct,album",
    access_sources_mode: "include",
    before: "2026-08-01T00:00:00.000Z",
    page: "4",
    per_page: "30",
  }));
  assertResult(result);
  const sql = normalizeSql(calls[0].sql);
  assert.match(sql, /select extract\(year from li\.captured_at\)/);
  assert.match(sql, /select distinct on \(shared_candidate\.photo_id\)/);
  assert.match(sql, /'direct'::text _access_source/);
  assert.match(sql, /'album'::text _access_source/);
  assert.match(sql, /coalesce\(us\.is_hidden,false\)=false/);
  assert.match(sql, /group by extract\(year from li\.captured_at\), extract\(month from li\.captured_at\)/);
  assert.equal(calls.some(({ params }) => params?.includes("2026-08-01T00:00:00.000Z")), false);
});

test("timeline library alone uses ownLibraryFastPath", async () => {
  resetCalls();
  const result = await orangePhotosService.timeline(ownerReq({
    access_sources: "library",
    access_sources_mode: "include",
  }));
  assertResult(result);
  const sql = normalizeSql(calls[0].sql);
  assert.match(sql, /select extract\(year from li\.captured_at\)/);
  assert.match(sql, /candidate\.user_id=\$2::uuid/);
  assert.match(sql, /li\._access_source='library'/);
  assert.doesNotMatch(sql, /logical_direct_share/);
  assert.doesNotMatch(sql, /logical_album_item/);
  assert.match(sql, /group by extract\(year from li\.captured_at\), extract\(month from li\.captured_at\)/);
});

test("timeline uses the same album source relation as the grid", async () => {
  resetCalls();
  await orangePhotosService.timeline(ownerReq({
    album_id: ALBUM_ID,
    access_sources: "owned,library",
    access_sources_mode: "include",
  }));
  const sql = normalizeSql(calls[0].sql);
  assert.match(sql, /selected_album_item/);
  assert.match(sql, /candidate\.user_id=selected_album_item\.source_user_id/);
});

test("album include sources are normalized by Node", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    album_id: ALBUM_ID,
    access_sources: "owned,library",
    access_sources_mode: "include",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /\(li\._access_source='owned' or li\._access_source='library' or li\._access_source='album'\)/);
});

test("album exclude sources are not expanded by Node", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    album_id: ALBUM_ID,
    access_sources: "owned,library",
    access_sources_mode: "exclude",
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /not \(li\._access_source='owned' or li\._access_source='library'\)/);
  assert.doesNotMatch(sql, /not \(li\._access_source='owned' or li\._access_source='library' or li\._access_source='album'\)/);
});

test("album without source filter remains unfiltered", async () => {
  resetCalls();
  const result = await orangePhotosService.list(ownerReq({
    album_id: ALBUM_ID,
    include_total: "false",
  }));
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /selected_album_item/);
  assert.match(sql, /candidate\.user_id=selected_album_item\.source_user_id/);
  assert.doesNotMatch(sql, /li\._access_source='/);
});

test("around-date newer preserves ascending temporal pagination", async () => {
  resetCalls();
  const result = await orangePhotosService.aroundDate(ownerReq({
    date: "2026-08-15T12:00:00.000Z",
    direction: "newer",
    access_sources: "owned,library",
    access_sources_mode: "include",
    per_page: "30",
  }));
  assertResult(result);
  const pageSql = normalizeSql(calls[0].sql);
  assert.match(pageSql, /li\.captured_at>\$[0-9]+::timestamptz/);
  assert.match(pageSql, /order by li\.captured_at asc nulls last,p\.created_at asc,p\.id asc/);
  assert.match(normalizeSql(calls.at(-1).sql), /has_newer/);
  assert.match(normalizeSql(calls.at(-1).sql), /has_older/);
});

test("around-date older preserves exclusive descending pagination", async () => {
  resetCalls();
  const result = await orangePhotosService.aroundDate(ownerReq({
    date: "2026-08-15T12:00:00.000Z",
    direction: "older",
    access_sources: "owned,library",
    access_sources_mode: "include",
    per_page: "30",
  }));
  assertResult(result);
  const pageSql = normalizeSql(calls[0].sql);
  assert.match(pageSql, /li\.captured_at<\$[0-9]+::timestamptz/);
  assert.match(pageSql, /order by li\.captured_at desc nulls last,p\.created_at desc,p\.id desc/);
  assert.match(normalizeSql(calls.at(-1).sql), /has_newer/);
  assert.match(normalizeSql(calls.at(-1).sql), /has_older/);
});

test("favorite filter and list projection use canonical user settings only", async () => {
  resetCalls();
  const result = await orangePhotosService.list(
    ownerReq(
      galleryQuery({
        favorite: "true",
      })
    )
  );
  assertResult(result);
  const sql = listingSql();
  assert.match(sql, /coalesce\(us\.is_favorite,false\)=\$[0-9]+/);
  assert.match(sql, /coalesce\(us\.is_favorite,false\) is_favorite/);
  assert.doesNotMatch(sql, /p\.is_favorite/);
});

test("detail favorite projection uses canonical user settings only", async () => {
  resetCalls();
  await orangePhotosService.detail(ownerReq(), ALBUM_ID);
  const call = calls.find(({ sql }) =>
    normalizeSql(sql).startsWith("select p.*")
  );
  assert.ok(call, "No se encontró la consulta de detalle.");
  const sql = normalizeSql(call.sql);
  assert.match(sql, /coalesce\(us\.is_favorite,false\) is_favorite/);
  assert.doesNotMatch(sql, /p\.is_favorite/);
});
