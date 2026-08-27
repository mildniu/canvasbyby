import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare(
  "SELECT value FROM user_settings WHERE user_id='5ef7e05e-3814-425e-a99b-afd02e7b62ae' AND key='apiKey'"
).get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172');
console.log('apiKey 解密:', key ? `${key.slice(0, 6)}...(长度${key.length})` : 'null 解密失败');
