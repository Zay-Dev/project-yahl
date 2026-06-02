import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  isRecord,
  looksLikeMarkdown,
  pickMarkdownField,
  pickTitle,
} from "@/pages/sessions/components/result-helpers";

type TSessionResultProps = {
  result: unknown;
};

const MarkdownBlock = ({ content }: { content: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);

const PrimitiveList = ({ record }: { record: Record<string, unknown> }) => (
  <dl className="grid gap-2 text-sm">
    {Object.entries(record).map(([key, value]) => (
      <div key={key} className="grid gap-0.5 sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">{key}</dt>
        <dd className="break-words font-medium">
          {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : JSON.stringify(value)}
        </dd>
      </div>
    ))}
  </dl>
);

const TakeawaysList = ({ items }: { items: unknown[] }) => (
  <ul className="list-disc space-y-2 pl-5 text-sm">
    {items.map((item, index) => (
      <li key={index}>
        {isRecord(item)
          ? (typeof item.text_zh === "string"
            ? item.text_zh
            : typeof item.text === "string"
              ? item.text
              : JSON.stringify(item))
          : String(item)}
      </li>
    ))}
  </ul>
);

const SectionsList = ({ sections }: { sections: unknown[] }) => (
  <div className="space-y-4">
    {sections.map((section, index) => {
      if (!isRecord(section)) {
        return null;
      }

      const heading = typeof section.heading === "string" ? section.heading : `Section ${index + 1}`;
      const body = typeof section.body_md === "string" ? section.body_md : undefined;

      return (
        <div key={index} className="rounded-lg border bg-background p-4">
          <p className="font-medium">{heading}</p>
          {body ? (
            <div className="mt-2">
              <MarkdownBlock content={body} />
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

const IntelTable = ({ rows }: { rows: unknown[] }) => {
  const records = rows.filter(isRecord);

  if (records.length === 0) {
    return null;
  }

  const columns = ["competitor", "title", "summary_zh", "category", "sentiment", "date"];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="p-2 text-left font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((row, index) => (
            <tr key={index} className="border-t">
              {columns.map((column) => (
                <td key={column} className="p-2 align-top">
                  {typeof row[column] === "string" || typeof row[column] === "number"
                    ? String(row[column])
                    : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StructuredResult = ({ record }: { record: Record<string, unknown> }) => {
  const title = pickTitle(record);
  const markdown = pickMarkdownField(record);
  const takeaways = Array.isArray(record.takeaways) ? record.takeaways : null;
  const sections = Array.isArray(record.sections) ? record.sections : null;
  const rawIntel = Array.isArray(record.raw_intel) ? record.raw_intel : null;

  return (
    <div className="space-y-4">
      {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
      {markdown ? <MarkdownBlock content={markdown.body} /> : null}
      {takeaways?.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Takeaways</p>
          <TakeawaysList items={takeaways} />
        </div>
      ) : null}
      {sections?.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Sections</p>
          <SectionsList sections={sections} />
        </div>
      ) : null}
      {rawIntel?.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Raw intel</p>
          <IntelTable rows={rawIntel} />
        </div>
      ) : null}
      {!markdown && !takeaways?.length && !sections?.length && !rawIntel?.length ? (
        <PrimitiveList record={record} />
      ) : null}
    </div>
  );
};

export function SessionResult({ result }: TSessionResultProps) {
  if (result === null || result === undefined) {
    return (
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Task result</p>
        <p className="mt-2 text-sm">No task result yet.</p>
      </div>
    );
  }

  if (typeof result === "string") {
    return (
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Task result</p>
        <div className="mt-3">
          {looksLikeMarkdown(result) ? (
            <MarkdownBlock content={result} />
          ) : (
            <p className="whitespace-pre-wrap text-sm">{result}</p>
          )}
        </div>
      </div>
    );
  }

  if (Array.isArray(result)) {
    return (
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Task result</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {result.map((item, index) => (
            <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!isRecord(result)) {
    return (
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Task result</p>
        <p className="mt-2 text-sm">{String(result)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">Task result</p>
      <div className="mt-3">
        <StructuredResult record={result} />
      </div>
    </div>
  );
}
