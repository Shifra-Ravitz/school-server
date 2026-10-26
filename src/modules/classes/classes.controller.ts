import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./classes.service.js";
import { classStudentsQuery, createClassSchema, listClassesQuery, updateClassSchema } from "./classes.schemas.js";

export async function list(req: Request, res: Response) {
  res.json(await service.listClasses(getAuth(req), parse(listClassesQuery, req.query)));
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.getClass(getAuth(req), id));
}

export async function students(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.listClassStudents(getAuth(req), id, parse(classStudentsQuery, req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.createClass(getAuth(req), parse(createClassSchema, req.body)));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await service.updateClass(getAuth(req), id, parse(updateClassSchema, req.body)));
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteClass(getAuth(req), id);
  res.status(204).end();
}
