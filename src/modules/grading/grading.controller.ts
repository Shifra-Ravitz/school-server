import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./grading.service.js";
import {
  createExamSchema,
  createPeriodSchema,
  finalGradesQuery,
  listExamsQuery,
  saveGradebookSchema,
  saveGradesSchema,
  updateExamSchema,
  updatePeriodSchema,
} from "./grading.schemas.js";

// ---- תקופות ----
export async function listPeriods(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.listPeriods(getAuth(req), id));
}

export async function createPeriod(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.status(201).json(await service.createPeriod(getAuth(req), id, parse(createPeriodSchema, req.body)));
}

export async function updatePeriod(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.updatePeriod(getAuth(req), id, parse(updatePeriodSchema, req.body)));
}

export async function deletePeriod(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deletePeriod(getAuth(req), id);
  res.status(204).end();
}

// ---- מבחנים ----
export async function listExams(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.listExams(getAuth(req), id, parse(listExamsQuery, req.query)));
}

export async function getExam(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getExam(getAuth(req), id));
}

export async function createExam(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.status(201).json(await service.createExam(getAuth(req), id, parse(createExamSchema, req.body)));
}

export async function updateExam(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.updateExam(getAuth(req), id, parse(updateExamSchema, req.body)));
}

export async function deleteExam(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteExam(getAuth(req), id);
  res.status(204).end();
}

// ---- ציונים ----
export async function getExamGrades(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getExamGrades(getAuth(req), id));
}

export async function saveExamGrades(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.saveExamGrades(getAuth(req), id, parse(saveGradesSchema, req.body)));
}

export async function finalGrades(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getFinalGrades(getAuth(req), id, parse(finalGradesQuery, req.query)));
}

export async function saveGradebook(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.saveGradebook(getAuth(req), id, parse(saveGradebookSchema, req.body)));
}
