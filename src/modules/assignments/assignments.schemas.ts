import { z } from "zod";
import { idParam } from "../../utils/validation.js";

export const listAssignmentsQuery = z.object({
  classId: idParam.optional(),
  teacherId: idParam.optional(),
  subjectId: idParam.optional(),
});

export const createAssignmentSchema = z.object({
  classId: idParam,
  subjectId: idParam,
  teacherId: idParam,
});

/** בשיבוץ קיים אפשר רק להחליף את המורה */
export const updateAssignmentSchema = z.object({
  teacherId: idParam,
});
