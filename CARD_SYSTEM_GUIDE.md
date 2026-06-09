# 卡片系统维护指南

本文档说明 `review_html` 项目中“卡片组页面”的维护方式。当前项目已经从“每个 HTML 页面手写一大段 `knowledgePoints`”迁移为“数据文件 + 模板 + 构建脚本”模式。

---

## 一、整体设计

当前卡片系统分为三层：

### 1. 数据层：`topics-data/`
用于存放卡片组内容和卡片组元信息。

- `topics-data/registry.json`：所有卡片组登记表
- `topics-data/<slug>.json`：某一个卡片组的具体卡片内容

### 2. 模板层：`templates/`
用于存放统一 HTML 模板。

- `templates/topic-page.template.html`

模板内使用占位符：
- `{{PAGE_TITLE}}`
- `{{SIDEBAR_TITLE}}`
- `{{PAGE_ID}}`
- `__KNOWLEDGE_POINTS_JSON__`

### 3. 构建层：`scripts/`
用于校验数据、生成页面、快速新增内容。

- `scripts/build_pages.py`
- `scripts/validate_topics.py`
- `scripts/add_group.py`
- `scripts/add_card.py`

---

## 二、核心文件说明

## 1）`topics-data/registry.json`
每个卡片组都要在这里注册。

示例：

```json
{
  "slug": "python",
  "page_id": "python-notes",
  "title": "Python知识点笔记",
  "sidebar_title": "Python 知识点笔记",
  "description": "Python 高频八股与工程实践问题，涵盖语言特性、并发、元编程与常用库。",
  "tag": "编程语言",
  "output": "python.html",
  "template": "templates/topic-page.template.html"
}
```

字段说明：

- `slug`：卡片组唯一标识，对应数据文件名
- `page_id`：页面内部使用的 id
- `title`：HTML `<title>` 和卡片组标题
- `sidebar_title`：右侧目录标题
- `description`：首页卡片描述
- `tag`：首页标签
- `output`：生成后的 HTML 文件名
- `template`：所使用模板路径

---

## 2）`topics-data/<slug>.json`
这里存放某个卡片组的具体内容。

示例：

```json
{
  "slug": "python",
  "title": "Python知识点笔记",
  "sidebar_title": "Python 知识点笔记",
  "page_id": "python-notes",
  "knowledge_points": [
    {
      "title": "1. Python中的==和is有什么区别？",
      "content": "<strong>本质差异：</strong>..."
    }
  ]
}
```

字段说明：

- `knowledge_points`：卡片数组
- 每张卡片至少要有：
  - `title`
  - `content`

其中 `content` 是 HTML 字符串，可以直接使用：
- `<strong>`
- `<br>`
- `<p>`
- `<ul>` / `<li>`
- 其它已有页面可接受的 HTML 结构

---

## 三、日常维护操作

## 1）新增一个卡片组
推荐命令：

```bash
python scripts/add_group.py --slug new-group --title "新卡片组"
```

可选参数：

```bash
python scripts/add_group.py \
  --slug java \
  --title "Java知识点笔记" \
  --sidebar-title "Java 高频知识点" \
  --description "Java 高频面试题整理" \
  --tag "编程语言"
```

执行后会自动：
- 把新分组写入 `registry.json`
- 新建 `topics-data/<slug>.json`
- 预放一张示例卡片

然后你需要执行：

```bash
python scripts/build_pages.py
```

---

## 2）给已有卡片组新增卡片
推荐命令：

```bash
python scripts/add_card.py --slug python --title "58. Python闭包是什么？"
```

如果希望同时写入内容：

```bash
python scripts/add_card.py \
  --slug python \
  --title "58. Python闭包是什么？" \
  --content "<strong>定义：</strong>闭包是..."
```

执行后再运行：

```bash
python scripts/build_pages.py
```

---

## 3）手工编辑卡片内容
如果你想精细修改卡片内容，直接编辑：

```text
topics-data/<slug>.json
```

改完后建议按顺序执行：

```bash
python scripts/validate_topics.py
python scripts/build_pages.py
```

---

## 四、推荐工作流

每次修改卡片系统内容，推荐按以下顺序：

```bash
python scripts/validate_topics.py
python scripts/build_pages.py
```

如果是新增卡片组：

```bash
python scripts/add_group.py --slug xxx --title "XXX"
python scripts/validate_topics.py
python scripts/build_pages.py
```

如果是新增单张卡片：

```bash
python scripts/add_card.py --slug python --title "新问题"
python scripts/validate_topics.py
python scripts/build_pages.py
```

---

## 五、构建脚本做了什么

`build_pages.py` 会自动完成：

1. 读取 `topics-data/registry.json`
2. 读取每个 `topics-data/<slug>.json`
3. 将数据注入 `templates/topic-page.template.html`
4. 生成对应 HTML 页面
5. 统计每组卡片数量
6. 自动生成新的 `index.html`

所以：

- **不要手工长期维护首页入口卡片**
- **不要再把大量 `knowledgePoints` 直接写回 HTML 源文件里**

HTML 现在应该被视为**构建产物**。

---

## 六、注意事项

### 1. `content` 是 HTML，不是 Markdown
目前 `knowledge_points[].content` 直接按 HTML 插入页面，因此：

- 可控性高
- 与旧页面兼容性好
- 但需要注意标签闭合正确

### 2. 修改模板会影响所有卡片页
`templates/topic-page.template.html` 属于全局模板。
修改它之后，建议立即重新构建所有页面并抽查至少 2~3 个页面。

### 3. 首页由脚本生成
如果你手工改了 `index.html`，下次运行 `build_pages.py` 会被覆盖。
因此首页的内容来源应当放在：
- `registry.json`
- `build_pages.py`

### 4. 旧脚本仅作参考
`_generate_topic_pages.py` 仍保留，但它是旧流程产物。后续如无特殊需要，应优先使用当前的：
- `topics-data/`
- `templates/`
- `scripts/build_pages.py`

---

## 七、故障排查

### 问题 1：新增卡片后页面没变化
先检查是否执行了：

```bash
python scripts/build_pages.py
```

### 问题 2：构建失败
先运行：

```bash
python scripts/validate_topics.py
```

常见原因：
- JSON 格式错误
- 某张卡片缺少 `title`
- 某张卡片缺少 `content`
- `registry.json` 中 slug 重复

### 问题 3：首页卡片信息不对
首页内容来自 `registry.json`，不是来自单个 HTML。
请重点检查：
- `title`
- `description`
- `tag`
- `output`

---

## 八、建议的后续优化

后续如继续演进，可考虑：

1. 增加根目录 `README.md`
2. 给 `add_card.py` 增加“自动编号”能力
3. 给 `build_pages.py` 增加“只构建单个卡片组”参数
4. 为 `topics-data/*.json` 增加更严格的 schema 校验
5. 增加简单回归测试，验证关键页面是否仍含必要 DOM 节点

---

## 九、一句话原则

以后维护卡片内容时，请遵循下面这条原则：

> **内容改 JSON，结构改模板，页面靠构建生成，不直接长期手改 HTML 大数组。**
