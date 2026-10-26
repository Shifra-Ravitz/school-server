import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./schedule.service.js";
import { createLessonSchema, updateLessonSchema } from "./schedule.schemas.js";

export async function mySchedule(req: Request, res: Response) {
  res.json(await service.mySchedule(getAuth(req)));
}

export async function classSchedule(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.classSchedule(getAuth(req), id));
}

export async function teacherSchedule(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.teacherSchedule(getAuth(req), id));
}

export async function createLesson(req: Request, res: Response) {
  res.status(201).json(await service.createLesson(getAuth(req), parse(createLessonSchema, req.body)));
}

export async function updateLesson(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.updateLesson(getAuth(req), id, parse(updateLessonSchema, req.body)));
}

export async function deleteLesson(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteLesson(getAuth(req), id);
  res.status(204).end();
}
