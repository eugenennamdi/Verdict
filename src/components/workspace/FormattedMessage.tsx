"use client";

import Link from "next/link";
import React from "react";

function renderInline(text: string): React.ReactNode[] {
  const pattern = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|(?:\/docs(?:\/[a-z0-9\-_]+)?)|(?:https?:\/\/[^\s]+)|\*.*?\*)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Markdown link: [label](url)
    const mdLinkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (mdLinkMatch) {
      const [, label, url] = mdLinkMatch;
      if (url.startsWith("/docs")) {
        return (
          <Link
            key={index}
            href={url}
            className="font-bold text-orange-500 hover:text-orange-600 underline underline-offset-3 decoration-orange-500/30"
          >
            {label}
          </Link>
        );
      }
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-orange-500 hover:text-orange-600 underline underline-offset-3 decoration-orange-500/30"
        >
          {label}
        </a>
      );
    }

    // Bare /docs link
    if (part.startsWith("/docs")) {
      return (
        <Link
          key={index}
          href={part}
          className="font-bold text-orange-500 hover:text-orange-600 underline underline-offset-3 decoration-orange-500/30"
        >
          {part}
        </Link>
      );
    }

    // Bare http(s) link
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-orange-500 hover:text-orange-600 underline underline-offset-3 decoration-orange-500/30"
        >
          {part}
        </a>
      );
    }

    // Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return <span key={index}>{part}</span>;
  });
}

export function FormattedMessage({ content }: { content: string }) {
  const text = content.replace(/\r\n/g, "\n");
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-3 text-[14.5px] leading-[1.7] text-slate-800 dark:text-slate-200">
      {paragraphs.map((para, pIndex) => {
        const lines = para.trim().split("\n");

        // Check if paragraph is a list of bullets
        const isBulletList = lines.every((line) => /^[-*•]\s+/.test(line.trim()));
        if (isBulletList && lines.length > 0) {
          return (
            <ul key={pIndex} className="space-y-1.5 pl-4 list-disc marker:text-orange-500">
              {lines.map((line, lIndex) => {
                const clean = line.trim().replace(/^[-*•]\s+/, "");
                return <li key={lIndex}>{renderInline(clean)}</li>;
              })}
            </ul>
          );
        }

        // Check if paragraph is a numbered list
        const isNumList = lines.every((line) => /^\d+[\.\)]\s+/.test(line.trim()));
        if (isNumList && lines.length > 0) {
          return (
            <ol key={pIndex} className="space-y-1.5 pl-4 list-decimal marker:font-bold marker:text-slate-400">
              {lines.map((line, lIndex) => {
                const clean = line.trim().replace(/^\d+[\.\)]\s+/, "");
                return <li key={lIndex}>{renderInline(clean)}</li>;
              })}
            </ol>
          );
        }

        // Heading: ### Heading
        if (lines.length === 1 && lines[0].startsWith("### ")) {
          return (
            <h4 key={pIndex} className="text-base font-bold text-slate-900 dark:text-white pt-1">
              {renderInline(lines[0].replace(/^###\s+/, ""))}
            </h4>
          );
        }

        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return (
            <h3 key={pIndex} className="text-lg font-black text-slate-900 dark:text-white pt-1">
              {renderInline(lines[0].replace(/^##\s+/, ""))}
            </h3>
          );
        }

        // Normal paragraph with potential line breaks
        return (
          <p key={pIndex}>
            {lines.map((line, lIndex) => (
              <React.Fragment key={lIndex}>
                {lIndex > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
