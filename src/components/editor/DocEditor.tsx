import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import { useNavigate } from "react-router-dom";
import type { TiptapDoc } from "@/schema/page";
import type { Component } from "@/schema/component";
import type { Page } from "@/schema/page";
import { Button } from "@/components/ui/button";

type MentionItem = {
  id: string;
  label: string;
  mentionType: "component" | "page";
};

function mentionSuggestion(getItems: () => MentionItem[]) {
  return {
    char: "@",
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return getItems()
        .filter((item) => item.label.toLowerCase().includes(q))
        .slice(0, 8);
    },
    command: ({
      editor,
      range,
      props,
    }: {
      editor: { chain: () => { focus: () => { insertContentAt: (range: never, node: unknown) => { run: () => boolean } } } };
      range: never;
      props: MentionItem;
    }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, {
          type: "mention",
          attrs: {
            id: props.id,
            label: props.label,
            mentionType: props.mentionType,
          },
        })
        .run();
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selected = 0;
      let current: SuggestionProps<MentionItem> | null = null;

      const draw = (props: SuggestionProps<MentionItem>) => {
        current = props;
        if (!popup) {
          popup = document.createElement("div");
          popup.className =
            "z-50 min-w-56 rounded-md border border-border bg-popover p-1 shadow-md";
          document.body.appendChild(popup);
        }
        const rect = props.clientRect?.();
        if (rect) {
          popup.style.position = "fixed";
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 6}px`;
        }
        popup.innerHTML = "";
        if (!props.items.length) {
          const empty = document.createElement("div");
          empty.className = "px-2 py-1.5 text-sm text-muted-foreground";
          empty.textContent = "No matches";
          popup.appendChild(empty);
          return;
        }
        props.items.forEach((item, index) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm ${
            index === selected ? "bg-accent" : ""
          }`;
          btn.innerHTML = `<span>${item.label}</span><span class="text-[11px] text-muted-foreground">${item.mentionType}</span>`;
          btn.onmousedown = (event) => {
            event.preventDefault();
            props.command(item);
          };
          popup?.appendChild(btn);
        });
      };

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          selected = 0;
          draw(props);
        },
        onUpdate: (props: SuggestionProps<MentionItem>) => {
          selected = 0;
          draw(props);
        },
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (!current) return false;
          if (event.key === "ArrowDown") {
            selected = (selected + 1) % Math.max(current.items.length, 1);
            draw(current);
            return true;
          }
          if (event.key === "ArrowUp") {
            selected =
              (selected - 1 + Math.max(current.items.length, 1)) %
              Math.max(current.items.length, 1);
            draw(current);
            return true;
          }
          if (event.key === "Enter") {
            const item = current.items[selected];
            if (item) current.command(item);
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
        },
      };
    },
  } as never;
}

export function DocEditor({
  doc,
  onChange,
  components,
  pages,
  placeholder = "Write, or type @ to mention…",
}: {
  doc: TiptapDoc;
  onChange: (doc: TiptapDoc) => void;
  components: Component[];
  pages: Page[];
  placeholder?: string;
}) {
  const navigate = useNavigate();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Image.configure({ allowBase64: false }),
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            mentionType: {
              default: "component",
              parseHTML: (element) => element.getAttribute("data-mention-type"),
              renderHTML: (attrs) => ({ "data-mention-type": attrs.mentionType }),
            },
          };
        },
      }).configure({
        HTMLAttributes: { class: "mention" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: mentionSuggestion(() => [
          ...components.map((c) => ({
            id: c.id,
            label: c.name,
            mentionType: "component" as const,
          })),
          ...pages
            .filter((p) => !p.componentId)
            .map((p) => ({
              id: p.id,
              label: p.title,
              mentionType: "page" as const,
            })),
        ]),
      }),
    ],
    content: doc,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as TiptapDoc);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(doc);
    if (current !== next) editor.commands.setContent(doc, { emitUpdate: false });
  }, [doc, editor]);

  if (!editor) return <div className="text-sm text-muted-foreground">Loading editor…</div>;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          List
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleTaskList().run()}>
          Tasks
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          Table
        </Button>
      </div>
      <div
        className="px-4 py-3"
        onClick={(event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>(".mention");
          if (!target) return;
          const id = target.getAttribute("data-id");
          const mentionType = target.getAttribute("data-mention-type");
          if (!id) return;
          if (mentionType === "page") navigate(`/pages/${id}`);
          else navigate(`/catalog/${id}`);
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
