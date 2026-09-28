import styles from "@/app/privacy-policy/privacy-policy.module.css";

type LegalRun = { text: string; bold: boolean };
type LegalParagraph = {
  type: "paragraph";
  style: string;
  runs: LegalRun[];
};
type LegalCell = {
  shade: string | null;
  paragraphs: Array<Pick<LegalParagraph, "style" | "runs">>;
};
type LegalTable = {
  type: "table";
  widths: number[];
  rows: Array<{ header: boolean; cells: LegalCell[] }>;
};
type LegalBlock = LegalParagraph | LegalTable;

export type LegalDocumentContent = { blocks: LegalBlock[] };

function RichText({ runs }: { runs: LegalRun[] }) {
  return runs.map((run, index) =>
    run.bold ? <strong key={index}>{run.text}</strong> : run.text,
  );
}

function paragraphText(paragraph: Pick<LegalParagraph, "runs">) {
  return paragraph.runs.map((run) => run.text).join("");
}

function LegalTableView({ table }: { table: LegalTable }) {
  const totalWidth = table.widths.reduce((sum, width) => sum + width, 0);
  const wide = table.widths.length > 2;

  return (
    <div className={styles.tableScroller} role="region" tabIndex={0}>
      <table className={`${styles.table} ${wide ? styles.tableWide : ""}`}>
        <colgroup>
          {table.widths.map((width, index) => (
            <col key={index} style={{ width: `${(width / totalWidth) * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => {
                const isHeader = row.header || cell.shade === "2A2927";
                const Cell = isHeader ? "th" : "td";
                const shadeClass =
                  cell.shade === "F4EFE5"
                    ? styles.tableLabel
                    : cell.shade === "F8F6F1"
                      ? styles.tableAlternate
                      : "";

                return (
                  <Cell
                    key={cellIndex}
                    scope={isHeader ? "col" : undefined}
                    className={shadeClass}
                  >
                    {cell.paragraphs.map((paragraph, paragraphIndex) => (
                      <p
                        key={paragraphIndex}
                        className={
                          paragraph.style === "ListBullet"
                            ? styles.tableBullet
                            : undefined
                        }
                      >
                        <RichText runs={paragraph.runs} />
                      </p>
                    ))}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  const content: React.ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "table") {
      content.push(<LegalTableView key={`table-${index}`} table={block} />);
      continue;
    }

    if (block.style === "ListBullet") {
      const items: LegalParagraph[] = [];
      let cursor = index;
      while (cursor < blocks.length) {
        const candidate = blocks[cursor];
        if (candidate.type !== "paragraph" || candidate.style !== "ListBullet") break;
        items.push(candidate);
        cursor += 1;
      }
      content.push(
        <ul key={`list-${index}`} className={styles.list}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}><RichText runs={item.runs} /></li>
          ))}
        </ul>,
      );
      index = cursor - 1;
      continue;
    }

    const text = paragraphText(block);
    if (!text.trim()) {
      content.push(<div key={`space-${index}`} className={styles.spacer} aria-hidden="true" />);
    } else if (block.style === "Heading1") {
      content.push(<h2 key={`h1-${index}`} className={styles.headingOne}><RichText runs={block.runs} /></h2>);
    } else if (block.style === "Heading2") {
      content.push(<h3 key={`h2-${index}`} className={styles.headingTwo}><RichText runs={block.runs} /></h3>);
    } else {
      content.push(<p key={`p-${index}`} className={styles.paragraph}><RichText runs={block.runs} /></p>);
    }
  }

  return content;
}

export function LegalDocument({ content, lang }: { content: LegalDocumentContent; lang: "en" | "ko" }) {
  const [title, subtitle, , ...body] = content.blocks;
  if (title.type !== "paragraph" || subtitle.type !== "paragraph") return null;

  return (
    <main className={styles.page}>
      <article className={`${styles.document} ${lang === "ko" ? styles.documentKorean : styles.documentEnglish}`}>
        <header className={styles.documentHeader}>
          <p className={styles.kicker}>SOUL TRACE / ETERNAL BEAM · TVA</p>
          <h1 className={styles.title}><RichText runs={title.runs} /></h1>
          <p className={styles.subtitle}><RichText runs={subtitle.runs} /></p>
          <div className={styles.goldDivider} aria-hidden="true" />
        </header>
        <div className={styles.policyBody}><LegalBlocks blocks={body} /></div>
      </article>
    </main>
  );
}
