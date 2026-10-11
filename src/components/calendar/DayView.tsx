"use client";

import { DayDetail, type DayActions } from "./DayPopup";

// Un sol dia, amb el mateix contingut que la finestra del dia (el títol ja surt a la barra de navegació)
export default function DayView({ date, ...rest }: DayActions & { date: string }) {
  return (
    <div className="max-w-3xl">
      <DayDetail key={date} date={date} {...rest} />
    </div>
  );
}
