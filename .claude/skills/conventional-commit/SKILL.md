---
name: conventional-commit
description: Generate git commit messages following Conventional Commits specification. Use when user asks to commit changes or write commit message.
---

# Conventional Commit 规范

根据当前 staged changes 生成符合规范的 commit message。

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（既不是新功能也不是修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/配置变更 |

## 执行步骤

1. 执行 `git diff --cached` 查看 staged changes
2. 分析变更内容，确定 type 和 scope
3. 生成简洁的 subject（一句话说明）
4. 在 body 中列出关键变更点
5. 如果有 breaking changes，在 footer 中标注
6. 执行 `git commit` 提交

## 注意事项

- subject 不超过 50 字符
- body 每行不超过 72 字符
- 使用中文描述（团队约定）
- 不要在 subject 末尾加句号
- scope 为可选，用于说明影响范围
