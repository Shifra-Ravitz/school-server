import { z } from "zod";
import { requiredText } from "../../utils/validation.js";

export const subjectSchema = z.object({ name: requiredText(2, 40) });
