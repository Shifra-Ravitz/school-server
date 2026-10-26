import type { Request, Response } from "express";
import { z } from "zod";
import { getAuth } from "../../middleware/auth.js";
import { dateString, parse } from "../../utils/validation.js";
import { todaysBirthdays } from "./birthdays.service.js";

/** ?date=YYYY-MM-DD אפשרי, למשל כדי להדגים יום הולדת בתאריך אחר */
const birthdaysQuery = z.object({ date: dateString.optional() });

export async function today(req: Request, res: Response) {
  const { date } = parse(birthdaysQuery, req.query);
  res.json(await todaysBirthdays(getAuth(req), date));
}
