# review_html 项目状态文档

> 最后更新：2026-06-06 18:02  
> GitHub 仓库：https://github.com/Suara17/review_html  
> Vercel 部署地址：https://review-html-five.vercel.app/

---

## 当前版本

| 项目 | 值 |
|------|-----|
| 基线状态 | 已完成“卡片内容数据化 + 模板化生成 + 首页自动生成”重构 |
| 分支 | main |
| 本地路径 | `/workspace/小万工作间/项目库/review_html` |
| 本地目录状态 | 当前目录仍是工作副本，本地无 `.git`；如需提交需临时 clone 仓库再同步文件 |

---

## 本轮完成事项（2026-06-06 18:02）

### 1）完成卡片系统数据驱动改造
原先每个 HTML 页面都直接内嵌一大段 `knowledgePoints` 数组，维护成本高，新增卡片组和新增卡片都容易出错。本轮已改造成：

- `topics-data/*.json`：存放每个卡片组的内容数据
- `topics-data/registry.json`：集中登记卡片组元信息
- `templates/topic-page.template.html`：统一页面模板
- `scripts/build_pages.py`：读取 JSON 数据并生成各 HTML 页面与首页
- `scripts/validate_topics.py`：校验 registry 和各卡片数据文件结构
- `scripts/add_group.py`：新增卡片组脚本
- `scripts/add_card.py`：新增卡片脚本

### 2）已完成历史页面数据迁移
已把以下 10 个页面中的 `knowledgePoints` 提取为独立 JSON 数据文件，并重新构建页面：

1. `computer-network`
2. `operating-system`
3. `mysql-topics`
4. `redis-topics`
5. `design-patterns-topics`
6. `system-design-topics`
7. `python`
8. `git-topics`
9. `guanlan`
10. `learning-research-agent`

对应数据目录：

```text
topics-data/
├── registry.json
├── computer-network.json
├── operating-system.json
├── mysql-topics.json
├── redis-topics.json
├── design-patterns-topics.json
├── system-design-topics.json
├── python.json
├── git-topics.json
├── guanlan.json
└── learning-research-agent.json
```

### 3）首页改为自动生成
`index.html` 已不再依赖手工维护卡片入口，而是由构建脚本自动根据 `registry.json` 和各组卡片数量生成。

### 4）保留原页面交互能力
此次重构目标是“把内容维护方式改成数据驱动”，不是推翻现有页面交互。因此保留了原有页面的大部分前端能力，包括：

- TTS 播放器接入逻辑
- 侧边栏结构与打开方式
- 卡片切换与编辑相关逻辑
- 页面原视觉风格

---

## 当前目录结构（重构后）

```text
review_html/
├── index.html
├── computer-network.html
├── operating-system.html
├── mysql-topics.html
├── redis-topics.html
├── design-patterns-topics.html
├── system-design-topics.html
├── python.html
├── git-topics.html
├── guanlan.html
├── learning-research-agent.html
├── PROJECT_STATUS.md
├── CARD_SYSTEM_GUIDE.md
├── scripts/
│   ├── build_pages.py
│   ├── validate_topics.py
│   ├── add_group.py
│   └── add_card.py
├── templates/
│   └── topic-page.template.html
├── topics-data/
│   ├── registry.json
│   └── *.json
├── sidebar-manager.js
├── tts-player.js
├── gist-sync.js
├── api/
│   └── tts.py
├── tests/
├── _generate_topic_pages.py
├── requirements.txt
└── vercel.json
```

---

## 使用方式

### 新增卡片组
```bash
python scripts/add_group.py --slug new-group --title "新卡片组"
python scripts/build_pages.py
```

### 为已有卡片组新增卡片
```bash
python scripts/add_card.py --slug python --title "新问题标题"
python scripts/build_pages.py
```

### 修改数据后重新生成页面
```bash
python scripts/validate_topics.py
python scripts/build_pages.py
```

---

## 兼容性说明

### 1. 现有 HTML 仍是最终产物
部署与访问方式没有变化，Vercel 仍然直接托管静态 HTML / JS 文件。

### 2. JSON 不是前端运行时接口
当前 JSON 主要用于“构建阶段”生成 HTML，不依赖浏览器运行时去额外拉取数据，因此兼容现有静态部署方式。

### 3. 旧生成器脚本仍保留
`_generate_topic_pages.py` 目前未删除，保留作历史参考；后续若确认完全不再使用，可再决定是否清理。

---

## 本轮校验结果

已执行并通过：

- `python scripts/validate_topics.py`
- `python scripts/build_pages.py`

构建结果：
- 成功生成 10 个卡片组页面
- 成功生成新的 `index.html`

---

## 当前仍需注意的问题

### 1. 当前工作目录不是 git clone
虽然文件内容已更新，但 `/workspace/小万工作间/项目库/review_html` 本身不是 Git 仓库目录，因此提交时需要：

- 临时 clone GitHub 仓库
- 将当前工作副本同步过去
- 再执行 commit / push

### 2. 建议后续补一个 README 入口
当前已有 `PROJECT_STATUS.md` 与 `CARD_SYSTEM_GUIDE.md`，后续可再增加更简洁的根目录 `README.md`，方便新维护者快速理解。

---

## 下一步建议

1. 提交并推送本轮“数据驱动卡片系统”改造
2. 线上部署后抽查首页和 2~3 个卡片页面是否正常
3. 如后续继续扩容内容，统一走 `topics-data + scripts/build_pages.py` 工作流
