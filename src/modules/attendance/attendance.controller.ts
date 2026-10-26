import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./attendance.service.js";
import {
  lessonRosterQuery,
  listAttendanceQuery,
  saveLessonAttendanceSchema,
  updateAttendanceSchema,
} from "./attendance.schemas.js";

export async function list(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.listAttendance(getAuth(req), id, parse(listAttendanceQuery, req.query)));
}

export async function lessonRoster(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getLessonRoster(getAuth(req), id, parse(lessonRosterQuery, req.query)));
}

export async function saveLesson(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.saveLessonAttendance(getAuth(req), id, parse(saveLessonAttendanceSchema, req.body)));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.updateAttendance(getAuth(req), id, parse(updateAttendanceSchema, req.body)));
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteAttendance(getAuth(req), id);
  res.status(204).end();
}
