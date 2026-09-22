# 变压器运行数据可视分析系统（纯前端）

与 `projects/Bilateral` 一样，本项目为纯 JS 静态站点，无需 Flask / Python 后端。

## 运行方式

在本目录启动任意静态服务器即可：

```bash
cd projects/time-series-data
npx --yes serve .
# 或
python3 -m http.server 8080
```

然后打开提示的本地地址（例如 `http://localhost:3000`）。

> 不要用 `file://` 直接打开：浏览器会拦截本地 JSON 的 fetch。

## 目录结构

```
index.html          # 页面入口
index.css           # 样式
index.js            # 前端交互 / 图表
js/api.js           # 本地数据 API（替代原 Flask）
js/echarts.min.js   # ECharts
data/json/*.json    # 预转换的数据
data/*.csv|xls      # 原始数据（可选保留）
tools/convert_to_json.py  # 原始数据 → JSON 转换脚本
```

## 重新生成 JSON

如需从 CSV/XLS 重新导出：

```bash
python3 tools/convert_to_json.py
```

（需安装 pandas / numpy / xlrd 或 openpyxl）

## 说明

- 运行数据已按小时预聚合，体积更小，满足小时/天/周/月等粒度分析。
- 原 `app.py` + `templates/` + `static/` 为旧 Flask 版本，可忽略；日常请使用根目录 `index.html`。
