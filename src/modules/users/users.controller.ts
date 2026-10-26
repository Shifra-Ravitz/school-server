import type { Request, Response } from "express";
import { z } from "zod";
import { getAuth } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import { idParams, parse } from "../../utils/validation.js";
import { sendFile } from "../../utils/files.js";
import * as usersService from "./users.service.js";
import * as importService from "./users.import.service.js";
import { createUserSchema, listUsersQuery, resetPasswordSchema, updateUserSchema } from "./users.schemas.js";

export async function list(req: Request, res: Response) {
  const query = parse(listUsersQuery, req.query);
  res.json(await usersService.listUsers(getAuth(req), query));
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json(await usersService.getUser(getAuth(req), id));
}

export async function create(req: Request, res: Response) {
  const body = parse(createUserSchema, req.body);
  res.status(201).json(await usersService.createUser(getAuth(req), body));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const body = parse(updateUserSchema, req.body);
  res.json(await usersService.updateUser(getAuth(req), id, body));
}

export async function resetPassword(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const body = parse(resetPasswordSchema, req.body ?? {});
  res.json(await usersService.resetPassword(getAuth(req), id, body.password));
}

export async function importTemplate(_req: Request, res: Response) {
  sendFile(res, await importService.buildTemplate(), "students-template.xlsx");
}

export async function importStudents(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, "INVALID_FILE", "יש לצרף קובץ אקסל בשדה בשם file");
  res.status(201).json(await importService.importStudents(getAuth(req), req.file.buffer));
}

export async function importPasswords(req: Request, res: Response) {
  const { importId } = parse(z.object({ importId: z.uuid({ message: "מזהה ייבוא לא תקין" }) }), req.params);
  sendFile(res, await importService.buildPasswordsFile(getAuth(req), importId), "student-passwords.xlsx");
}
