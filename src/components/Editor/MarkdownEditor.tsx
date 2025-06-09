import { insertBlankLine } from '@codemirror/commands';
import { EditorSelection, Extension, Prec } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap, placeholder as placeholderExt } from '@codemirror/view';
import classcat from 'classcat';
import { EditorPosition, Editor as ObsidianEditor, Platform } from 'obsidian';
import { MutableRefObject, useContext, useEffect, useRef } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, noop } from '../helpers';
import { EditState, isEditing } from '../types';
import { datePlugins, stateManagerField } from './dateWidget';
import { matchDateTrigger, matchTimeTrigger } from './suggest';

interface MarkdownEditorProps {
  editorRef?: MutableRefObject<EditorView>;               // 用于挂载编辑器的div
  editState?: EditState;
  onEnter: (cm: EditorView, mod: boolean, shift: boolean) => boolean; // 回车事件
  onEscape: (cm: EditorView) => void;                     // Esc事件
  onSubmit: (cm: EditorView) => void;                     // 提交事件
  onPaste?: (e: ClipboardEvent, cm: EditorView) => void;  // 粘贴事件
  onChange?: (update: ViewUpdate) => void;                // 内容变化时回调
  value?: string;                                         // 初始内容
  className: string;                                      // 类名
  placeholder?: string;                                   // 占位符
}

export function allowNewLine(stateManager: StateManager, mod: boolean, shift: boolean) {
  if (Platform.isMobile) return !(mod || shift);
  return stateManager.getSetting('new-line-trigger') === 'enter' ? !(mod || shift) : mod || shift;
}

function getEditorAppProxy(view: KanbanView) {
  return new Proxy(view.app, {
    get(target, prop, reveiver) {
      if (prop === 'vault') {
        return new Proxy(view.app.vault, {
          get(target, prop, reveiver) {
            if (prop === 'config') {
              return new Proxy((view.app.vault as any).config, {
                get(target, prop, reveiver) {
                  if (['showLineNumber', 'foldHeading', 'foldIndent'].includes(prop as string)) {
                    return false;
                  }
                  return Reflect.get(target, prop, reveiver);
                },
              });
            }
            return Reflect.get(target, prop, reveiver);
          },
        });
      }
      return Reflect.get(target, prop, reveiver);
    },
  });
}

function getMarkdownController(
  view: KanbanView,
  getEditor: () => ObsidianEditor
): Record<any, any> {
  return {
    app: view.app,
    showSearch: noop,
    toggleMode: noop,
    onMarkdownScroll: noop,
    getMode: () => 'source',
    scroll: 0,
    editMode: null,
    get editor() {
      return getEditor();
    },
    get file() {
      return view.file;
    },
    get path() {
      return view.file.path;
    },
  };
}

// 伪造 controller 对象 (构造错误不影响编辑功能，但影响保存功能)
// export function makeFakeController(app: App, view: MarkdownView|null, getEditor: () => Editor|null): Record<any, any> {
// 	return {
// 		app,
// 		showSearch: () => { },
// 		toggleMode: () => { },
// 		onMarkdownScroll: () => { },
// 		getMode: () => "source",
// 		scroll: 0,
// 		editMode: null,
// 		get editor() { return ()=>{} },
// 		get file() { return ()=>{} },
// 		get path() { return ()=>{} }
// 	}
// }

function setInsertMode(cm: EditorView) {
  const vim = getVimPlugin(cm);
  if (vim) {
    (window as any).CodeMirrorAdapter?.Vim?.enterInsertMode(vim);
  }
}

function getVimPlugin(cm: EditorView): string {
  return (cm as any)?.plugins?.find((p: any) => {
    if (!p?.value) return false;
    return 'useNextTextInput' in p.value && 'waitForCopy' in p.value;
  })?.value?.cm;
}

export function MarkdownEditor({
  editorRef,
  onEnter,
  onEscape,
  onChange,
  onPaste,
  className,
  onSubmit,
  editState,
  value,
  placeholder,
}: MarkdownEditorProps) {
  const { view, stateManager } = useContext(KanbanContext);
  const elRef = useRef<HTMLDivElement>();
  const internalRef = useRef<EditorView>();

  useEffect(() => {
    class Editor extends view.plugin.MarkdownEditor {
      isKanbanEditor = true;

      showTasksPluginAutoSuggest(
        cursor: EditorPosition,
        editor: ObsidianEditor,
        lineHasGlobalFilter: boolean
      ) {
        if (matchTimeTrigger(stateManager.getSetting('time-trigger'), editor, cursor)) return false;
        if (matchDateTrigger(stateManager.getSetting('date-trigger'), editor, cursor)) return false;
        if (lineHasGlobalFilter && cursor.line === 0) return true;
        return undefined;
      }

      updateBottomPadding() {}
      onUpdate(update: ViewUpdate, changed: boolean) {
        super.onUpdate(update, changed);
        onChange && onChange(update);
      }
      buildLocalExtensions(): Extension[] {
        // obsidian自带扩展 (无法兼容插件扩展的行为)
        const extensions = super.buildLocalExtensions();

        // 管理和同步看板的状态
        // extensions.push(stateManagerField.init(() => stateManager));

        // 日期插件
        // extensions.push(datePlugins);

        // 为编辑器添加 focus 和 blur 事件的监听器
        // extensions.push(
        //   Prec.highest(
        //     EditorView.domEventHandlers({
        //       focus: (evt) => {
        //         view.activeEditor = this.owner;
        //         if (Platform.isMobile) {
        //           view.contentEl.addClass('is-mobile-editing');
        //         }
        // 
        //         evt.win.setTimeout(() => {
        //           this.app.workspace.activeEditor = this.owner;
        //           if (Platform.isMobile) {
        //             this.app.mobileToolbar.update();
        //           }
        //         });
        //         return true;
        //       },
        //       blur: () => {
        //         if (Platform.isMobile) {
        //           view.contentEl.removeClass('is-mobile-editing');
        //           this.app.mobileToolbar.update();
        //         }
        //         return true;
        //       },
        //     })
        //   )
        // );

        // 如果传入了 placeholder，则为编辑器设置输入占位符提示文字
        // if (placeholder) extensions.push(placeholderExt(placeholder));

        // 添加 paste 事件监听，如果传入了 onPaste，则处理粘贴事件，例如自定义内容粘贴行为
        // if (onPaste) {
        //   extensions.push(
        //     Prec.high(
        //       EditorView.domEventHandlers({
        //         paste: onPaste,
        //       })
        //     )
        //   );
        // }

        // 监听按键 (Esc/Enter退出编辑，Mod(Shift)+Enter才是换行)
        const makeEnterHandler = (mod: boolean, shift: boolean) => (cm: EditorView) => {
          const didRun = onEnter(cm, mod, shift);
          if (didRun) return true;
          if (this.app.vault.getConfig('smartIndentList')) {
            this.editor.newlineAndIndentContinueMarkdownList();
          } else {
            insertBlankLine(cm as any);
          }
          return true;
        };
        extensions.push(
          Prec.highest(
            keymap.of([
              {
                key: 'Enter',
                run: makeEnterHandler(false, false),
                shift: makeEnterHandler(false, true),
                preventDefault: true,
              },
              {
                key: 'Mod-Enter',
                run: makeEnterHandler(true, false),
                shift: makeEnterHandler(true, true),
                preventDefault: true,
              },
              {
                key: 'Escape',
                run: (cm) => {
                  onEscape(cm);
                  return false;
                },
                preventDefault: true,
              },
            ])
          )
        );

        return extensions;
      }
    }

    const controller = getMarkdownController(view, () => editor.editor); // [!code hl]
    // const controller = makeFakeController(this.app, view, () => editor.editor); // [!code hl]
    const app = getEditorAppProxy(view);
    const editor = view.plugin.addChild(new (Editor as any)(app, elRef.current, controller));
    const cm: EditorView = editor.cm;

    internalRef.current = cm;
    if (editorRef) editorRef.current = cm;

    
    controller.editMode = editor;
    editor.set(value || ''); // 必须，否则样式失效

    // if (isEditing(editState)) {
    //   cm.dispatch({
    //     userEvent: 'select.pointer',
    //     selection: EditorSelection.single(cm.posAtCoords(editState, false)),
    //   });

    //   cm.dom.win.setTimeout(() => {
    //     setInsertMode(cm);
    //   });
    // }

    const onShow = () => {
      elRef.current.scrollIntoView({ block: 'end' });
    };

    // if (Platform.isMobile) {
    //   cm.dom.win.addEventListener('keyboardDidShow', onShow);
    // }

    return () => {
      if (Platform.isMobile) {
        cm.dom.win.removeEventListener('keyboardDidShow', onShow);

        if (view.activeEditor === controller) {
          view.activeEditor = null;
        }

        if (app.workspace.activeEditor === controller) {
          app.workspace.activeEditor = null;
          (app as any).mobileToolbar.update();
          view.contentEl.removeClass('is-mobile-editing');
        }
      }
      view.plugin.removeChild(editor);
      internalRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []);

  const cls = ['cm-table-widget']; // 这个是cm表格的样式。按理不关这事，可能想借用ob实时表格的一些样式
  if (className) cls.push(className);

  return (
    <>
      <div className={classcat(cls)} ref={elRef}></div>
      {Platform.isMobile && ( // 如果是移动端则加一个按钮
        <button
          onClick={() => onSubmit(internalRef.current)}
          className={classcat([c('item-submit-button'), 'mod-cta'])}
        >
          {t('Submit')}
        </button>
      )}
    </>
  );
}
