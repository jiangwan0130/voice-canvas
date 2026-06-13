# Commit 提交规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范。

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**：提交类型（必填）
- **scope**：影响范围，如模块名（可选）
- **subject**：简短描述，不超过 50 字符，结尾不加句号（必填）
- **body**：详细描述，说明做了什么、为什么这样做（可选）
- **footer**：关联 Issue，如 `Closes #123`（可选）

## Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能，如空格、缩进、分号） |
| `refactor` | 重构（既不是新功能也不是修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/配置/依赖变更 |
| `revert` | 撤销某次提交 |
| `ci` | CI/CD 流程变更 |

## Scope 参考

| Scope | 说明 |
|-------|------|
| `frontend` | 前端整体 |
| `backend` | 后端整体 |
| `canvas` | 画布相关功能 |
| `voice` | 语音相关功能 |
| `auth` | 认证/权限 |
| `api` | 接口层 |
| `ui` | 通用 UI 组件 |
| `docs` | 文档 |

## 示例

```
feat(voice): 添加实时语音录制功能

- 实现浏览器 MediaRecorder API 集成
- 支持 WAV / MP3 格式导出
- 添加录制状态可视化波形

Closes #12
```

```
fix(canvas): 修复多节点拖拽时坐标偏移问题

- 修正鼠标相对坐标计算逻辑
- 增加边界限制防止节点溢出画布

Closes #34
```

```
revert: 撤销 feat(voice): 添加实时语音录制功能

This reverts commit a1b2c3d.
原因：该功能与 Safari 存在兼容性问题，暂时回退待修复
```

## 注意事项

1. **每个 PR 只做一件事** — 单一功能，鼓励小粒度提交
2. **保持持续提交** — 不要临尾突击提交
3. **commit 时间戳** 必须在开发周期内
4. **PR 描述** 必须包含：标题、功能描述、实现思路、测试方式
5. **敏感信息** — 不要提交 API 密钥、密码等
6. **subject 使用中文** — 简短清晰，动词开头（如"添加"、"修复"、"优化"）
