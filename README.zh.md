# 开发解析

构建

```bash
npm install
npm run build

# 项目script有yarn命令，项目也有yarn.lock文件
# 但工作流是用npm的，以工作流文件为准
# yarn install
# yarn run build
```

## 创建一个区域的CM编辑器

这也是我读该仓库的原因

thanks https://github.com/Fevol/obsidian-criticmarkup/blob/6f2e8ed3fcf3a548875f7bd2fe09b9df2870e4fd/src/ui/embeddable-editor.ts
thanks https://github.com/mgmeyers/obsidian-kanban/blob/main/src/components/Editor/MarkdownEditor.tsx#L134 (关键位置)

- FakeEditor | src/components/Editor/MarkdownEditor.tsx#L115
- view:KanbanView | src/KanbanView.tsx
- MarkdownEditor | src/main.ts#L41
```ts
// src/main.ts#L41
const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

// (some .tsx)
<MarkdownEditor />

// src/KanbanView.tsx#L31
export class KanbanView extends TextFileView implements HoverParent {...}

// src/component/Editor/MarkdownEditor.tsx#L98
export function MarkdownEditor(...) { return <...> }

// #L226
class Editor extends view.plugin.MarkdownEditor {...}

// #L226
const editor = view.plugin.addChild(new (Editor as any)(app, elRef.current, controller)); // src/component/Editor/MarkdownEditor.tsx#L226

// #L278 这个是可编辑区域的核心
<div className={classcat(cls)} ref={elRef}></div>
```

buildLocalExtensions() overload

详见 MarkdwonEditor.tsx 中的注释

## 学习成果

https://github.com/mProjectsCode/obsidian-shiki-plugin/pull/51 的 renderCallout 部分、EditableEditor.ts 部分

去除了 react 等大部分依赖
