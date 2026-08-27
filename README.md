# CanvasByBy (老牛 创意生成)

现代化多模型 AI 图像生成与创作工作台，支持多模型智能协议自适配、积分制额度管理、专属接口免积分通道与 700+ 精选灵感模板库。

---

## ✨ 核心特性

- 🎨 **多模型支持与协议自适应**：
  - 支持 **Qwen 系列**（通义万相 2.0 / 图像编辑 `Qwen-Image-Edit-2509`）、**GPT 系列**（`gpt-image-2` / `dall-e-3`）、**Gemini 系列**（多模态对话生图协议）、**Grok 系列** 等主流模型。
  - 支持文生图与图生图（支持上传最多 10 张参考图并前端智能无损压缩）。
  - 支持 1:1、16:9、9:16、4:3、3:4 等多种主流画幅比例。

- 🪙 **完善的用户积分与计费体系**：
  - **阶梯定价**：Qwen 系列 1 积分 / 次，GPT / Gemini / Grok 系列 2 积分 / 次。
  - **新用户初始赠送**：默认赠送 20 积分。
  - **安全退费机制**：若上游接口异常导致任务失败，系统自动原路返还扣除积分。
  - **专属接口免积分特权**：普通用户可在「设置」中配置自己的私有 Base URL 与 API Key，配置后生图完全免费，不消耗任何平台积分！

- 🛡️ **管理员（Admin）后台与安全隔离**：
  - 管理员拥有独立看板，可创建用户、调整权限、重置密码、一键充值/自定义积分余额。
  - 普通用户使用平台共享接口时，接口自动脱敏，物理阻断对默认内网 IP、端口与 Key 的泄露。

- 💡 **精选灵感模板库（700+ 条）**：
  - 收录整合 `freestylefly/awesome-gpt-image-2`、`awesome-gpt-image` 等高质量案例。
  - 全量封面图本地化 WebP 高速缓存，秒开无外网依赖。
  - 支持多维度分类筛选、关键词搜索与一键将 Prompt 带入创作。

---

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Lucide Icons
- **后端**：Node.js + Fastify + TypeScript + Better-SQLite3
- **加密与安全**：AES-256-GCM 独立密文存储 + scrypt 密码加盐哈希 + HMAC-SHA256 会话签名

---

## 🚀 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 并配置密钥与管理员初始密码：

```bash
cp .env.example .env
```

```env
PORT=3300
DATA_DIR=./data
ACCESS_PASSWORD=your_admin_password
SECRET_KEY=your_secret_key_at_least_32_characters
```

### 3. 构建与启动

```bash
# 构建前端
npm run build -w web

# 启动服务（监听 0.0.0.0:3300）
npm run start
```

---

## 🧪 自动化测试

```bash
npm test -w server
```

---

## 📄 开源许可

[MIT License](LICENSE)
