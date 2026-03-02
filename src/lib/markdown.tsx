import React from "react";

// Utility to enrich content with icons and to convert scripture references to markdown links
export const enrichContentWithIcons = (content: string): string => {
  let enriched = content;

  // Add icons to scripture refs and convert to link markdown
  enriched = enriched.replace(
    /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|John|Jude|Revelation)\s+(\d+):(\d+)/gi,
    (_match, book, chap, verse) => {
      const label = `\u{1F4D6} ${book} ${chap}:${verse}`;
      const href = `bible://${encodeURIComponent(`${book} ${chap}:${verse}`)}`;
      return `[${label}](${href})`;
    }
  );

  enriched = enriched.replace(
    /\b(Jesus|Christ|God|Holy Spirit|salvation|grace|faith|love|forgiveness|redemption|covenant|kingdom|eternal|resurrection)\b/gi,
    (match) => `${match}`
  );

  enriched = enriched.replace(/^\*\*([^*]+)\*\*$/gm, "\u{1F4A1} **$1**");
  enriched = enriched.replace(/^\s*(Key Point|Key Teaching|Main Idea|Important|Remember|Note):/gmi, "\u2B50 **$1:**");
  enriched = enriched.replace(/^\s*(Application|How to|Practice):/gmi, "\u2728 **$1:**");
  enriched = enriched.replace(/^\s*(Question|Question:|Reflect):/gmi, "\u{1F914} **$1:**");
  enriched = enriched.replace(/^\s*(Warning|Caution):/gmi, "\u26A0\uFE0F **$1:**");
  enriched = enriched.replace(/^\s*(Lesson|Teaching|Truth):/gmi, "\u{1F4DA} **$1:**");
  enriched = enriched.replace(/^\s*(-\s+)([^*][^-\n]+(?:do|apply|practice|remember|believe|trust))/gmi, `- \u2705 $2`);

  return enriched;
};

export const markdownLinkComponents = (openBibleRef: (ref: string) => void) => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: ({ href, children, ...props }: any) => {
    const h = String(href || "");
    if (h.startsWith("bible://")) {
      const ref = decodeURIComponent(h.replace("bible://", ""));
      return (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openBibleRef(ref);
          }}
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
});
