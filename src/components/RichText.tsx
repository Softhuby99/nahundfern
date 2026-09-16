// Öffentliche Textdarstellung. Ältere Berichte sind Markdown, neue kommen als
// HTML aus dem Studio-Editor — beides läuft durch dieselbe Bereinigung, damit
// niemals fremdes Skript im Browser landet.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "s", "span", "mark"],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "style"],
    p: [...(defaultSchema.attributes?.p ?? []), "style"],
    li: [...(defaultSchema.attributes?.li ?? []), "style"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "style"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "style"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "style"],
  },
};

export function RichText({ content, className }: { content: string; className?: string }) {
  if (!content.trim()) return null;
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
