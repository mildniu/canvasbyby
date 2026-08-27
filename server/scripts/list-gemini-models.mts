import Database from 'better-sqlite3';
import { decrypt } from '../src/crypto.js';

const db = new Database('/home/ctyun/demo/aigc-studio/data/aigc.db');
const row = db.prepare("SELECT value FROM user_settings WHERE user_id='admin' AND key='apiKey'").get() as any;
const key = decrypt(row.value, 'b5085aec3956d0067d09ab199e18ef81f10dc3f16d9fe254ffb931d60b52f172') || '';
const res = await fetch('http://192.168.0.80:8080/v1/models', { headers: { Authorization: `Bearer ${key}` } });
const json: any = await res.json();
const ids: string[] = (json.data || []).map((m: any) => m.id);
console.log('全部模型:');
for (const id of ids) console.log(' ', id);
console.log('\ngemini/imagen 相关:');
for (const id of ids.filter((i) => /gemini|imagen/i.test(i))) console.log(' ', id);
