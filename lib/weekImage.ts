import { formatDayShort, formatWeekTitle } from "./dates";
import { ROLES, type Role } from "./roles";
import type { Person, Shift } from "./types";

type ImageOptions = {
  weekStart: string;
  saturday: string;
  shifts: Shift[];
  people: Person[];
};

type ImageRow = {
  friday: Shift | null;
  saturday: Shift | null;
};

type ImageGroup = {
  role: Role;
  rows: ImageRow[];
};

const SCALE = 2;
const WIDTH = 1240;
const MARGIN = 48;
const TITLE_HEIGHT = 132;
const HEADER_HEIGHT = 74;
const ROW_HEIGHT = 66;
const FOOTER_HEIGHT = 54;
const ROLE_WIDTH = 124;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function drawDayCell(
  ctx: CanvasRenderingContext2D,
  shift: Shift | null,
  personName: string | undefined,
  role: Role,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!shift || !personName) return;

  const padding = 18;
  const time = shift.startTime ?? "—";
  ctx.font = "700 18px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const timeWidth = Math.max(56, ctx.measureText(time).width + 24);
  const pillHeight = 34;
  const pillX = x + width - padding - timeWidth;
  const pillY = y + (height - pillHeight) / 2;

  ctx.font = "700 20px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const name = fitText(
    ctx,
    personName,
    Math.max(40, pillX - x - padding * 2),
  );
  ctx.fillText(name, x + padding, y + height / 2 + 1);

  roundedRect(ctx, pillX, pillY, timeWidth, pillHeight, 10);
  ctx.fillStyle = role.color;
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 17px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(time, pillX + timeWidth / 2, pillY + pillHeight / 2 + 1);
}

export async function generateWeekImageBlob({
  weekStart,
  saturday,
  shifts,
  people,
}: ImageOptions): Promise<Blob> {
  const peopleById = new Map(people.map((person) => [person.id, person.name]));
  const weekShifts = shifts.filter(
    (shift) =>
      shift.personId !== null &&
      (shift.date === weekStart || shift.date === saturday),
  );

  const groups: ImageGroup[] = [];

  for (const role of ROLES) {
    const rows: ImageRow[] = [];
    for (let slot = 0; slot < role.slots; slot++) {
      const friday =
        weekShifts.find(
          (shift) =>
            shift.date === weekStart &&
            shift.role === role.key &&
            shift.slot === slot,
        ) ?? null;
      const sat =
        weekShifts.find(
          (shift) =>
            shift.date === saturday &&
            shift.role === role.key &&
            shift.slot === slot,
        ) ?? null;
      if (friday || sat) rows.push({ friday, saturday: sat });
    }
    if (rows.length) groups.push({ role, rows });
  }

  if (!groups.length) {
    throw new Error("Ten weekend nie ma jeszcze żadnej obsady.");
  }

  const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const height =
    MARGIN * 2 + TITLE_HEIGHT + HEADER_HEIGHT + totalRows * ROW_HEIGHT + FOOTER_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nie udało się wygenerować obrazu.");
  ctx.scale(SCALE, SCALE);

  const background = ctx.createLinearGradient(0, 0, WIDTH, height);
  background.addColorStop(0, "#fdf2f8");
  background.addColorStop(0.45, "#eef2ff");
  background.addColorStop(1, "#ecfeff");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, height);

  const cardX = MARGIN;
  const cardY = MARGIN;
  const cardW = WIDTH - MARGIN * 2;
  const cardH = height - MARGIN * 2;

  ctx.save();
  ctx.shadowColor = "rgba(49, 46, 129, 0.16)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#312e81";
  ctx.font = "800 40px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("GRAFIK TEATRO", cardX + 36, cardY + 32);

  ctx.fillStyle = "#4f46e5";
  ctx.font = "600 25px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(formatWeekTitle(weekStart, saturday), cardX + 36, cardY + 84);

  const tableX = cardX + 36;
  const tableY = cardY + TITLE_HEIGHT;
  const tableW = cardW - 72;
  const dayWidth = (tableW - ROLE_WIDTH) / 2;

  ctx.save();
  roundedRect(
    ctx,
    tableX,
    tableY,
    tableW,
    HEADER_HEIGHT + totalRows * ROW_HEIGHT,
    16,
  );
  ctx.clip();

  roundedRect(ctx, tableX, tableY, tableW, HEADER_HEIGHT, 16);
  ctx.fillStyle = "#4338ca";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ROLA", tableX + 18, tableY + HEADER_HEIGHT / 2);
  ctx.textAlign = "center";
  ctx.fillText(
    `PIĄTEK · ${formatDayShort(weekStart)}`,
    tableX + ROLE_WIDTH + dayWidth / 2,
    tableY + HEADER_HEIGHT / 2,
  );
  ctx.fillText(
    `SOBOTA · ${formatDayShort(saturday)}`,
    tableX + ROLE_WIDTH + dayWidth * 1.5,
    tableY + HEADER_HEIGHT / 2,
  );

  let y = tableY + HEADER_HEIGHT;

  for (const group of groups) {
    const groupHeight = group.rows.length * ROW_HEIGHT;

    ctx.fillStyle = group.role.color;
    ctx.fillRect(tableX, y, ROLE_WIDTH, groupHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (group.rows.length === 1) {
      ctx.font = "800 19px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.fillText(
        group.role.label,
        tableX + ROLE_WIDTH / 2,
        y + groupHeight / 2,
      );
    } else {
      ctx.save();
      ctx.translate(tableX + ROLE_WIDTH / 2, y + groupHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = "800 21px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.fillText(group.role.label, 0, 0);
      ctx.restore();
    }

    group.rows.forEach((row, index) => {
      const rowY = y + index * ROW_HEIGHT;

      if (index % 2 === 0) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(tableX + ROLE_WIDTH, rowY, tableW - ROLE_WIDTH, ROW_HEIGHT);
      }

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX + ROLE_WIDTH, rowY);
      ctx.lineTo(tableX + tableW, rowY);
      ctx.stroke();

      if (row.friday) {
        drawDayCell(
          ctx,
          row.friday,
          peopleById.get(row.friday.personId as number),
          group.role,
          tableX + ROLE_WIDTH,
          rowY,
          dayWidth,
          ROW_HEIGHT,
        );
      }

      if (row.saturday) {
        drawDayCell(
          ctx,
          row.saturday,
          peopleById.get(row.saturday.personId as number),
          group.role,
          tableX + ROLE_WIDTH + dayWidth,
          rowY,
          dayWidth,
          ROW_HEIGHT,
        );
      }

      ctx.strokeStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(tableX + ROLE_WIDTH + dayWidth, rowY);
      ctx.lineTo(tableX + ROLE_WIDTH + dayWidth, rowY + ROW_HEIGHT);
      ctx.stroke();
    });

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tableX, y);
    ctx.lineTo(tableX + tableW, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tableX, y + groupHeight);
    ctx.lineTo(tableX + tableW, y + groupHeight);
    ctx.stroke();

    y += groupHeight;
  }

  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  roundedRect(ctx, tableX, tableY, tableW, y - tableY, 16);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 17px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Wygenerowano w Grafiku Teatro",
    tableX,
    y + FOOTER_HEIGHT / 2,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Nie udało się wygenerować obrazu."));
    }, "image/png");
  });
}

export async function downloadWeekImage(options: ImageOptions): Promise<void> {
  const blob = await generateWeekImageBlob(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grafik-${options.weekStart}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareWeekImage(
  options: ImageOptions,
): Promise<"shared" | "downloaded"> {
  const blob = await generateWeekImageBlob(options);
  const file = new File([blob], `grafik-${options.weekStart}.png`, {
    type: "image/png",
  });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "Grafik Teatro",
        text: "Grafik na weekend",
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grafik-${options.weekStart}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}
