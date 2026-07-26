/* global module */
const CLIENT_TYPES=new Set(["web","android_sync","desktop","public","system","legacy"]);
const INSTALLATION_ID_RE=/^[A-Za-z0-9._-]{1,200}$/;

function clientContext(req){
  const requested=String(req?.headers?.["x-orange-client"]||"").trim();
  const installation=String(req?.headers?.["x-orange-installation-id"]||"").trim();
  return {clientType:CLIENT_TYPES.has(requested)?requested:"web",installationId:INSTALLATION_ID_RE.test(installation)?installation:null};
}

module.exports={clientContext};
