import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./assignments.service.js";
import { createAssignmentSchema, listAssignmentsQuery, updateAssignmentSchema } from "./assignments.schemas.js";

export async function list(req: Request, res: Response) {
  res.json(await service.listAssignments(getAuth(req), parse(listAssignmentsQuery, req.query)));
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getAssignment(getAuth(req), id));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.createAssignment(getAuth(req), parse(createAssignmentSchema, req.body)));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { teacherId } = parse(updateAssignmentSchema, req.body);
  res.json(await service.updateAssignment(getAuth(req), id, teacherId));
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteAssignment(getAuth(req), id);
  res.status(204).end();
}
