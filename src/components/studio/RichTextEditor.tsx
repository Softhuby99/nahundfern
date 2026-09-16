// Formatierbarer Text für Reiseberichte: Fett, Kursiv, Unterstrichen,
// Durchgestrichen, Überschriften, Listen, Zitat, Link, Schriftart,
// Schriftgröße und Textfarbe. Gespeichert wird HTML.
//
// Die deutsche Rechtschreibprüfung des Browsers ist aktiv (spellcheck + lang),
// dafür braucht es keinen externen Dienst.
import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";

const FONTS: { label: string; value: string }[] = [
  { label: "Standard", value: "" },
  { label: "Serifenlos", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Schreibmaschine", value: "ui-monospace, 'Courier New', monospace" },
];

const SIZES: { label: string; value: string }[] = [
  { label: "Normal", value: "" },
  { label: "Klein", value: "0.875rem" },
  { label: "Groß", value: "1.25rem" },
  { label: "Sehr groß", value: "1.5rem" },
];

const COLORS: { label: string; value: string }[] = [
  { label: "Standard", value: "" },
  { label: "Akzent", value: "#c2410c" },
  { label: "Blau", value: "#1d4ed8" },
  { label: "Grün", value: "#15803d" },
  { label: "Grau", value: "#6b7280" },
];

function ToolbarButton({
  active,
  label,
  title,
  onClick,
}: {
  active?: boolean;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active ? true : undefined}
      onClick={onClick}
      className={`px-2 py-1 font-mono text-[11px] border rounded-sm ${
        active ? "border-primary text-primary" : "border-border text-foreground"
      } hover:border-primary`}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-1 border border-border border-b-0 bg-card p-2 rounded-t-sm">
      <ToolbarButton
        label="B"
        title="Fett"
        active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="Kursiv"
        active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarButton
        label="U"
        title="Unterstrichen"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolbarButton
        label="S"
        title="Durchgestrichen"
        active={editor.isActive("strike")}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolbarButton
        label="H2"
        title="Überschrift"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="H3"
        title="Unterüberschrift"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        label="• Liste"
        title="Aufzählung"
        active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1. Liste"
        title="Nummerierte Liste"
        active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Zitat"
        title="Zitat"
        active={editor.isActive("blockquote")}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Link"
        title="Link einfügen oder entfernen"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            chain().unsetLink().run();
            return;
          }
          const url = window.prompt("Adresse (https://…)");
          if (!url) return;
          if (!/^https?:\/\//i.test(url)) {
            window.alert("Bitte eine Adresse mit https:// eintragen.");
            return;
          }
          chain().setLink({ href: url }).run();
        }}
      />

      <select
        aria-label="Schriftart"
        className="ml-2 bg-background border border-border rounded-sm px-1 py-1 text-[11px] font-mono"
        value={(editor.getAttributes("textStyle").fontFamily as string) ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) chain().setFontFamily(v).run();
          else chain().unsetFontFamily().run();
        }}
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Schriftgröße"
        className="bg-background border border-border rounded-sm px-1 py-1 text-[11px] font-mono"
        value={(editor.getAttributes("textStyle").fontSize as string) ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) chain().setFontSize(v).run();
          else chain().unsetFontSize().run();
        }}
      >
        {SIZES.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Textfarbe"
        className="bg-background border border-border rounded-sm px-1 py-1 text-[11px] font-mono"
        value={(editor.getAttributes("textStyle").color as string) ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) chain().setColor(v).run();
          else chain().unsetColor().run();
        }}
      >
        {COLORS.map((c) => (
          <option key={c.label} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  ariaLabel,
  minHeight = 180,
}: {
  value: string;
  onChange?: (html: string) => void;
  /** Wird beim Verlassen des Feldes mit dem aktuellen HTML aufgerufen. */
  onBlur?: (html: string) => void;
  ariaLabel?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TextStyleKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "studio-richtext",
        spellcheck: "true",
        lang: "de",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
    onBlur: ({ editor: e }) => onBlur?.(e.getHTML()),
  });

  // Wechselt die Station im Dialog, muss der Inhalt neu geladen werden.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || "") !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // Absichtlich nur auf `value` reagieren — sonst überschreibt jeder
    // Tastendruck die Auswahl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="border border-border bg-card rounded-sm p-3 font-mono text-[11px] text-muted-foreground"
        style={{ minHeight }}
      >
        Editor wird geladen …
      </div>
    );
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="border border-border bg-background rounded-b-sm p-3"
        style={{ minHeight }}
      />
    </div>
  );
}
