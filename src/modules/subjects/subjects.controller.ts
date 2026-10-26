import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./subjects.service.js";
import { subjectSchema } from "./subjects.schemas.js";

export async function list(req: Request, res: Response) {
  res.json(await service.listSubjects(getAuth(req)));
}

export async function create(req: Request, res: Response) {
  const { name } = parse(subjectSchema, req.body);
  res.status(201).json(await service.createSubject(getAuth(req), name));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { name } = parse(subjectSchema, req.body);
  res.json(await service.updateSubject(getAuth(req), id, name));
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteSubject(getAuth(req), id);
  res.status(204).end();
}
