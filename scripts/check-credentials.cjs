// Runs with TypeScript installed; no DB, Redis or OAuth required.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {randomBytes} = require('node:crypto');
const fs = require('node:fs');
const ts = require('typescript');
const {Module} = require('node:module');
const filename = require('node:path').resolve(__dirname,'../apps/backend/src/utils/secrets.ts');
const mod = new Module(filename,module);
mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {encryptSecret,decryptSecret,validateEncryptionKey,isEncrypted}=mod.exports;
process.env.CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('hex');
test('authenticated encryption round trips and uses fresh IVs',()=>{const a=encryptSecret('secret'),b=encryptSecret('secret');assert.notEqual(a,b);assert.ok(isEncrypted(a));assert.equal(decryptSecret(a),'secret');});
test('tampering and wrong key fail authentication',()=>{const a=encryptSecret('secret');const parts=a.split(':');const data=Buffer.from(parts[4],'base64');data[0]^=1;parts[4]=data.toString('base64');assert.throws(()=>decryptSecret(parts.join(':')));const old=process.env.CREDENTIAL_ENCRYPTION_KEY;try{process.env.CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('hex');assert.throws(()=>decryptSecret(a));}finally{process.env.CREDENTIAL_ENCRYPTION_KEY=old;}});
test('plaintext credentials and invalid keys are rejected',()=>{assert.throws(()=>decryptSecret('plaintext'));const old=process.env.CREDENTIAL_ENCRYPTION_KEY;try{process.env.CREDENTIAL_ENCRYPTION_KEY='bad';assert.throws(validateEncryptionKey);}finally{process.env.CREDENTIAL_ENCRYPTION_KEY=old;}});
