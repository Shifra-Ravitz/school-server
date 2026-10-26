import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { parse } from "../../utils/validation.js";
import * as service from "./me.service.js";
import { myAttendanceQuery, myGradesQuery } from "./me.schemas.js";

export async function grades(req: Request, res: Response) {
  res.json(await service.myGrades(getAuth(req), parse(myGradesQuery, req.query)));
}

export async function attendance(req: Request, res: Response) {
  res.json(await service.myAttendance(getAuth(req), parse(myAttendanceQuery, req.query)));
}
