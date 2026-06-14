import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
};

function ensureMeta(selector: string, attributeName: string, attributeValue: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const meta = document.createElement("meta");
  meta.setAttribute(attributeName, attributeValue);
  document.head.appendChild(meta);
  return meta;
}

export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = ensureMeta('meta[name="description"]', "name", "description");
    const ogTitleMeta = ensureMeta('meta[property="og:title"]', "property", "og:title");
    const ogDescriptionMeta = ensureMeta('meta[property="og:description"]', "property", "og:description");
    const twitterTitleMeta = ensureMeta('meta[name="twitter:title"]', "name", "twitter:title");
    const twitterDescriptionMeta = ensureMeta('meta[name="twitter:description"]', "name", "twitter:description");

    document.title = title;
    descriptionMeta.setAttribute("content", description);
    ogTitleMeta.setAttribute("content", title);
    ogDescriptionMeta.setAttribute("content", description);
    twitterTitleMeta.setAttribute("content", title);
    twitterDescriptionMeta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
    };
  }, [description, title]);
}
