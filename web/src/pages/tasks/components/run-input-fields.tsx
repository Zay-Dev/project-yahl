import type { TRunInputField } from "@project-yahl/server/modules/tasks/-api-types";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const initialRunInputValues = (
  fields: TRunInputField[],
  existing?: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    fields.map((field) => {
      const current = existing?.[field.key];

      if (current !== undefined && current !== "") {
        return [field.key, current];
      }

      if (field.default !== undefined) {
        return [field.key, field.default];
      }

      if (field.type === "enum" && field.options?.length) {
        return [field.key, field.options[0] ?? ""];
      }

      return [field.key, ""];
    }),
  );

type TRunInputFieldsFormProps = {
  fields: TRunInputField[];
  onChange: (values: Record<string, string>) => void;
  title?: string;
  values: Record<string, string>;
};

export function RunInputFieldsForm({
  fields,
  onChange,
  title = "Run input",
  values,
}: TRunInputFieldsFormProps) {
  if (fields.length === 0) {
    return null;
  }

  const setValue = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <p className="text-sm font-medium">{title}</p>
      {fields.map((field) => (
        <label className="flex flex-col gap-2 text-sm" key={field.key}>
          <span className="font-medium">{field.key}</span>
          {field.type === "textarea" ? (
            <Textarea
              className="min-h-24 font-mono text-xs"
              onChange={(event) => setValue(field.key, event.target.value)}
              value={values[field.key] ?? ""}
            />
          ) : field.type === "enum" ? (
            <select
              className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              onChange={(event) => setValue(field.key, event.target.value)}
              value={values[field.key] ?? ""}
            >
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              className="font-mono text-xs"
              onChange={(event) => setValue(field.key, event.target.value)}
              value={values[field.key] ?? ""}
            />
          )}
        </label>
      ))}
    </div>
  );
}
