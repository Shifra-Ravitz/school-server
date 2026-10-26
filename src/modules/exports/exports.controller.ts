import type { Request, Response } from "express";
import { z } from "zod";
import { getAuth } from "../../middleware/auth.js";
import { sendFile } from "../../utils/files.js";
import { idParam, parse } from "../../utils/validation.js";
import * as service from "./exports.service.js";

const studentsQuery = z.object({ classId: idParam.optional() });
const gradesQuery = z.object({ assignmentId: idParam });

export async function students(req: Request, res: Response) {
  const { classId } = parse(studentsQuery, req.query);
  sendFile(res, await service.studentsCsv(getAuth(req), classId), "students.csv");
}

export async function teachers(req: Request, res: Response) {
  sendFile(res, await service.teachersCsv(getAuth(req)), "teachers.csv");
}

export async function grades(req: Request, res: Response) {
  const { assignmentId } = parse(gradesQuery, req.query);
  const { csv, filename } = await service.gradesCsv(getAuth(req), assignmentId);
  // שם קובץ בעברית - בקידוד שהדפדפנים מבינים
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="grades.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.send(csv);
}
