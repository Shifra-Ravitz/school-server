import type { Role } from "@prisma/client";

/** פרטי המשתמשת המחוברת, כפי שהשרת מזהה אותה מה־Token */
export interface AuthUser {
  id: number;
  role: Role;
  schoolId: number;
  classId: number | null;
  firstName: string;
  lastName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}
