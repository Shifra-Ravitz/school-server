import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { classSummary, personSummary } from "../../utils/serializers.js";
import type { inboxQuery, sendMessageSchema } from "./messages.schemas.js";

const AUDIENCE_LABELS = {
  ALL: "כל המורות והתלמידות",
  TEACHERS: "כל המורות",
  STUDENTS: "כל התלמידות",
  CLASS: "כיתה",
} as const;

/**
 * שליחת הודעה: נוצר עותק לכל נמענת, כדי שכל אחת תוכל לסמן "נקראה" ולמחוק אצלה בלבד.
 */
export async function sendMessage(auth: AuthUser, data: z.infer<typeof sendMessageSchema>) {
  let recipientsWhere: Prisma.UserWhereInput;
  let classId: number | null = null;

  switch (data.audience) {
    case "ALL":
      recipientsWhere = { role: { in: ["TEACHER", "STUDENT"] } };
      break;
    case "TEACHERS":
      recipientsWhere = { role: "TEACHER" };
      break;
    case "STUDENTS":
      recipientsWhere = { role: "STUDENT" };
      break;
    case "CLASS": {
      const cls = await prisma.class.findFirst({ where: { id: data.classId!, schoolId: auth.schoolId } });
      if (!cls) throw badRequest("הכיתה לא קיימת", [{ field: "classId", message: "כיתה לא קיימת" }]);
      classId = cls.id;
      recipientsWhere = { role: "STUDENT", classId: cls.id };
      break;
    }
  }

  const recipients = await prisma.user.findMany({
    where: { ...recipientsWhere, schoolId: auth.schoolId, isActive: true, id: { not: auth.id } },
    select: { id: true },
  });

  const message = await prisma.message.create({
    data: {
      schoolId: auth.schoolId,
      senderId: auth.id,
      title: data.title,
      body: data.body,
      audience: data.audience,
      classId,
      recipients: { create: recipients.map((r) => ({ userId: r.id })) },
    },
    include: { class: true, sender: { select: { id: true, firstName: true, lastName: true } } },
  });

  return {
    id: message.id,
    title: message.title,
    body: message.body,
    audience: message.audience,
    audienceLabel: AUDIENCE_LABELS[message.audience],
    class: message.class ? classSummary(message.class) : null,
    createdAt: message.createdAt.toISOString(),
    recipientsCount: recipients.length,
  };
}

/** תיבת ההודעות של המשתמשת המחוברת (בלי הודעות שמחקה) */
export async function inbox(auth: AuthUser, q: z.infer<typeof inboxQuery>) {
  const base: Prisma.MessageRecipientWhereInput = { userId: auth.id, deletedAt: null };
  const [rows, unreadCount] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: { ...base, ...(q.unread === true ? { readAt: null } : q.unread === false ? { readAt: { not: null } } : {}) },
      include: {
        message: { include: { class: true, sender: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { message: { createdAt: "desc" } },
    }),
    prisma.messageRecipient.count({ where: { ...base, readAt: null } }),
  ]);

  return {
    unreadCount,
    items: rows.map((r) => ({
      id: r.message.id,
      title: r.message.title,
      body: r.message.body,
      audience: r.message.audience,
      audienceLabel: AUDIENCE_LABELS[r.message.audience],
      class: r.message.class ? classSummary(r.message.class) : null,
      sender: personSummary(r.message.sender),
      createdAt: r.message.createdAt.toISOString(),
      isRead: r.readAt !== null,
      readAt: r.readAt?.toISOString() ?? null,
    })),
  };
}

/** ההודעות שהמנהלת שלחה, עם כמה נמענות וכמה קראו */
export async function sentMessages(auth: AuthUser) {
  const messages = await prisma.message.findMany({
    where: { senderId: auth.id },
    orderBy: { createdAt: "desc" },
    include: { class: true, recipients: { select: { readAt: true } } },
  });
  return messages.map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    audience: m.audience,
    audienceLabel: AUDIENCE_LABELS[m.audience],
    class: m.class ? classSummary(m.class) : null,
    createdAt: m.createdAt.toISOString(),
    recipientsCount: m.recipients.length,
    readCount: m.recipients.filter((r) => r.readAt !== null).length,
  }));
}

async function findMyCopy(auth: AuthUser, messageId: number) {
  const copy = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId: auth.id } },
  });
  if (!copy || copy.deletedAt) throw notFound("ההודעה");
  return copy;
}

export async function markRead(auth: AuthUser, messageId: number) {
  const copy = await findMyCopy(auth, messageId);
  if (!copy.readAt) {
    await prisma.messageRecipient.update({
      where: { messageId_userId: { messageId, userId: auth.id } },
      data: { readAt: new Date() },
    });
  }
}

export async function markAllRead(auth: AuthUser) {
  const { count } = await prisma.messageRecipient.updateMany({
    where: { userId: auth.id, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: count };
}

/** מחיקה מהתיבה של המשתמשת בלבד. אצל שאר הנמענות ההודעה נשארת. */
export async function deleteForMe(auth: AuthUser, messageId: number) {
  await findMyCopy(auth, messageId);
  await prisma.messageRecipient.update({
    where: { messageId_userId: { messageId, userId: auth.id } },
    data: { deletedAt: new Date() },
  });
}
