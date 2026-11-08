import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from '../lib/utils';

const components: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener" />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="scroll-thin overflow-x-auto">
      <table {...props} />
    </div>
  ),
  input: ({ node: _node, ...props }) => (
    <input {...props} className="mr-2 translate-y-[1px] accent-[var(--accent)]" disabled />
  ),
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx('prose-movaryn', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
