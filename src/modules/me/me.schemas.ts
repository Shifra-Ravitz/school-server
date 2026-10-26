import { z } from "zod";
import { idParam } from "../../utils/validation.js";

export const myGradesQuery = z.object({
  subjectId: idParam.optional(),
  periodId: idParam.optional(),
});

export { myAttendanceQuery } from "../attendance/attendance.schemas.js";
