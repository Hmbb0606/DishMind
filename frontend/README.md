# DishMind Frontend

前端现在不再直接调用 Gemini demo，而是通过 `frontend/server.ts` 启动一个桥接层：

- Node 负责页面渲染和 `/api/chat`
- `/api/chat` 会自动拉起 Python RAG 进程
- Python 端复用项目原有的检索、重写、路由和生成逻辑

## 运行方式

1. 本地开发默认使用 `cook-rag` conda 环境，并安装根目录 `requirements.txt`
2. 在项目根目录 `.env` 中配置模型密钥，例如 `DEEPSEEK_API_KEY`
3. 安装前端依赖：

```bash
cd frontend
npm install
```

4. 启动前端：

```bash
npm run dev
```

默认地址：`http://localhost:3000`

## 启动模式

- 本地开发：`PYTHON_BRIDGE_MODE=conda`
- Docker/服务器：`PYTHON_BRIDGE_MODE=direct`

默认还支持：

- `CONDA_ENV_NAME`：本地 conda 环境名，默认 `cook-rag`
- `PYTHON_BIN`：Python 可执行文件名，默认 `python`

## 当前能力

- 对话结果按 Markdown 渲染，保留 emoji 和标题
- 可复制回答、收藏菜谱
- 右上角“私房菜谱本”支持查看收藏、删除收藏、查看收藏日期
- 收藏详情页可查看完整菜谱并进入交互式烹饪模式
