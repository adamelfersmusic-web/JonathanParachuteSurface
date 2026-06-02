import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Turn [[Target]] / [[Target|Label]] into a normal markdown link with a custom
// `wikilink:` scheme. The renderer below intercepts that scheme and routes the
// click in-app instead of navigating the browser. (Good enough for our notes;
// it does not try to skip wikilinks inside code fences.)
function rewriteWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+?)\]\]/g, (_match, inner: string) => {
    const [target, label] = inner.split("|");
    const text = (label ?? target).trim();
    const href = `wikilink:${encodeURIComponent(target.trim())}`;
    return `[${text}](${href})`;
  });
}

export function Markdown({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate: (target: string) => void;
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            if (href && href.startsWith("wikilink:")) {
              const target = decodeURIComponent(href.slice("wikilink:".length));
              return (
                <button
                  type="button"
                  className="wikilink"
                  onClick={() => onNavigate(target)}
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {rewriteWikilinks(content)}
      </ReactMarkdown>
    </div>
  );
}
