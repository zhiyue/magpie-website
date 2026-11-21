# Magpie 官网

Magpie 的介绍页：随手保存链接和图片，交给你自己的 AI 整理进知识库。

The website of Magpie, in Chinese and English. It is a static site: one HTML page per language, one stylesheet and one small script, with no framework and no dependencies at build time.

这个仓库只包含官网。Magpie 服务本身和本地 daemon 在各自的仓库里。

## 本地查看

需要 Node.js 22 或更新版本。

```sh
npm ci          # 只安装代码格式工具，构建本身不依赖任何包
npm run preview # 构建并在 http://localhost:4321/ 打开
```

`npm run build` 把网站生成到 `dist/`：

```text
dist/
  index.html        英文页面，也是没有指定语言时打开的页面
  zh-CN/index.html  简体中文页面
  assets/           样式和脚本
  robots.txt
```

页面里的地址全部是相对地址，`dist/` 放在域名根目录或任何子目录下都能正常打开。用 `node serve.mjs 4321 /some/folder` 可以在子目录下预览。

## 配置

`site.config.json`：

| 配置              | 作用                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `siteUrl`         | 官网自己的地址，例如 `https://magpie.example.org`。留空时页面不向搜索引擎声明地址和语言版本，也不生成站点地图 |
| `appUrl`          | Magpie 服务的地址。“登录”按钮和“隐私说明”链接指向这里                                                         |
| `languages`       | 提供哪些语言，也是语言菜单里的顺序                                                                            |
| `defaultLanguage` | 放在根目录的语言，其余语言各占一个子目录                                                                      |
| `links`           | 页面上的源代码和文档链接                                                                                      |

构建时可以用环境变量临时覆盖前两项：`SITE_URL=https://magpie.example.org npm run build`。

## 发布

`dist/` 是普通的静态文件，可以放到任何静态托管服务上，例如 Cloudflare Pages、Cloudflare Workers 的静态资源、GitHub Pages 或自己的服务器。确定地址后先填好 `siteUrl` 再构建。

样式和脚本的地址带有内容指纹（`site.css?v=…`），内容一变地址就变，可以放心让托管服务长期缓存 `assets/`。

## 语言

访客第一次打开根目录的页面时，会按浏览器的语言偏好进入对应语言；在语言菜单里选过之后以选择为准。直接打开某个语言的地址（例如 `/zh-CN/`）总是显示那个语言。

所有文字都在 `src/locales/` 下，每种语言一个文件。增加一种语言：

1. 复制 `src/locales/en.json` 为新文件，例如 `ja.json`，翻译其中的文字。
2. 在 `site.config.json` 的 `languages` 里加上 `"ja"`。

页面模板 `src/index.html` 用 `{{分组.名称}}` 引用文字，不直接写任何界面文字。

## 检查

```sh
npm test             # 文字、链接和构建结果
npm run format:check # 代码格式
```

测试会确认：每种语言的文字条目一致；页面用到的条目都存在，没有多余的；模板里没有写死的文字；每个语言的页面完整生成；页面内的链接和文件地址都有效，并且在任何目录下都能用。每次推送，GitHub 会自动运行这些检查。

## 目录

```text
src/index.html       页面模板
src/locales/         各语言的文字
src/assets/site.css  样式
src/assets/site.js   语言选择
build.mjs            构建脚本
serve.mjs            本地预览
site.config.json     地址和链接
test/                检查
```
