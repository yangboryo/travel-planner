var assert = require("assert");
var webcrypto = require("crypto").webcrypto;

global.crypto = webcrypto;
global.btoa = function (value) { return Buffer.from(value, "binary").toString("base64"); };
global.atob = function (value) { return Buffer.from(value, "base64").toString("binary"); };

var sync = require("../js/sync.js");

(async function () {
  var salt = webcrypto.getRandomValues(new Uint8Array(16));
  var iv = webcrypto.getRandomValues(new Uint8Array(12));
  var key = await sync.deriveEncryptionKey("correct horse battery staple", salt);
  var plaintext = new TextEncoder().encode('{"trips":[{"city":"Tokyo"}]}');
  var encrypted = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
  var decrypted = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
  assert.strictEqual(new TextDecoder().decode(decrypted), new TextDecoder().decode(plaintext));

  var wrongKey = await sync.deriveEncryptionKey("wrong password", salt);
  await assert.rejects(function () {
    return webcrypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, wrongKey, encrypted);
  });

  var encoded = sync.bytesToBase64(new Uint8Array([0, 1, 127, 128, 255]));
  assert.deepStrictEqual(Array.from(sync.base64ToBytes(encoded)), [0, 1, 127, 128, 255]);
  console.log("sync encryption tests passed");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
