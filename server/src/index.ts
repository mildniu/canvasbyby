import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3300);
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), '..', 'data');
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD ?? '';
const SECRET_KEY = process.env.SECRET_KEY ?? '';

if (!ACCESS_PASSWORD) {
  console.error('错误：请设置环境变量 ACCESS_PASSWORD（网页登录密码）');
  process.exit(1);
}
// SECRET_KEY 用于 cookie 签名 + API Key 落库加密；未设置则每次启动随机生成
// （随机意味着重启后所有会话失效、已存 API Key 解不开，生产必须固定）
const secretKey = SECRET_KEY || randomBytes(32).toString('hex');
if (!SECRET_KEY) {
  console.warn('警告：未设置 SECRET_KEY，已随机生成。重启后登录态与已保存的 API Key 将失效，生产环境请在 .env 固定它');
}

const app = await buildApp({ accessPassword: ACCESS_PASSWORD, secretKey, dataDir: DATA_DIR });

// 生产模式托管前端 dist（以 server/src 为锚点定位，兼容任意 cwd）
const distDir = process.env.WEB_DIST ?? join(import.meta.dirname, '..', '..', 'web', 'dist');
if (existsSync(distDir)) {
  const fastifyStatic = (await import('@fastify/static')).default;
  await app.register(fastifyStatic, { root: distDir, prefix: '/' });
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/media/')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });
}

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`AIGC Studio 已启动: http://0.0.0.0:${PORT}  (数据目录: ${DATA_DIR})`);
