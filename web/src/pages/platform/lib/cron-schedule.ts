export type TCronPreset =
  | "custom"
  | "daily"
  | "every_n_minutes"
  | "hourly"
  | "weekday";

export type TCronScheduleUi = {
  hour: string;
  minute: string;
  nMinutes: string;
  preset: TCronPreset;
  raw: string;
};

export const EMPTY_CRON_SCHEDULE_UI: TCronScheduleUi = {
  hour: "8",
  minute: "0",
  nMinutes: "15",
  preset: "daily",
  raw: "0 8 * * *",
};

const clampInt = (raw: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(raw, 10);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, n));
};

export const composeCronExpression = (ui: TCronScheduleUi): string => {
  if (ui.preset === "custom") {
    return ui.raw.trim();
  }

  const minute = clampInt(ui.minute, 0, 59, 0);
  const hour = clampInt(ui.hour, 0, 23, 8);
  const nMinutes = clampInt(ui.nMinutes, 1, 59, 15);

  if (ui.preset === "daily") {
    return `${minute} ${hour} * * *`;
  }

  if (ui.preset === "weekday") {
    return `${minute} ${hour} * * 1-5`;
  }

  if (ui.preset === "hourly") {
    return `${minute} * * * *`;
  }

  return `*/${nMinutes} * * * *`;
};

export const describeCronExpression = (expression: string, ui: TCronScheduleUi): string => {
  if (ui.preset === "daily") {
    return `Every day at ${pad2(ui.hour)}:${pad2(ui.minute)}`;
  }

  if (ui.preset === "weekday") {
    return `Every weekday (Mon–Fri) at ${pad2(ui.hour)}:${pad2(ui.minute)}`;
  }

  if (ui.preset === "hourly") {
    return `Every hour at minute ${clampInt(ui.minute, 0, 59, 0)}`;
  }

  if (ui.preset === "every_n_minutes") {
    return `Every ${clampInt(ui.nMinutes, 1, 59, 15)} minutes`;
  }

  return expression.trim() ? `Custom: ${expression.trim()}` : "Custom cron expression";
};

const pad2 = (raw: string) => String(clampInt(raw, 0, 59, 0)).padStart(2, "0");

export const parseCronExpression = (expression: string): TCronScheduleUi => {
  const raw = expression.trim();
  const parts = raw.split(/\s+/);

  if (parts.length !== 5) {
    return { ...EMPTY_CRON_SCHEDULE_UI, preset: "custom", raw };
  }

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  if (dayPart !== "*" || monthPart !== "*") {
    return { ...EMPTY_CRON_SCHEDULE_UI, preset: "custom", raw };
  }

  if (/^\*\/\d+$/.test(minutePart) && hourPart === "*" && weekdayPart === "*") {
    return {
      ...EMPTY_CRON_SCHEDULE_UI,
      nMinutes: minutePart.slice(2),
      preset: "every_n_minutes",
      raw,
    };
  }

  if (/^\d+$/.test(minutePart) && hourPart === "*" && weekdayPart === "*") {
    return {
      ...EMPTY_CRON_SCHEDULE_UI,
      minute: minutePart,
      preset: "hourly",
      raw,
    };
  }

  if (/^\d+$/.test(minutePart) && /^\d+$/.test(hourPart) && weekdayPart === "*") {
    return {
      ...EMPTY_CRON_SCHEDULE_UI,
      hour: hourPart,
      minute: minutePart,
      preset: "daily",
      raw,
    };
  }

  if (/^\d+$/.test(minutePart) && /^\d+$/.test(hourPart) && weekdayPart === "1-5") {
    return {
      ...EMPTY_CRON_SCHEDULE_UI,
      hour: hourPart,
      minute: minutePart,
      preset: "weekday",
      raw,
    };
  }

  return { ...EMPTY_CRON_SCHEDULE_UI, preset: "custom", raw };
};
