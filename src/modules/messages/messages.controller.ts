import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { idParams, parse } from "../../utils/validation.js";
import * as service from "./messages.service.js";
import { inboxQuery, sendMessageSchema } from "./messages.schemas.js";

export async function inbox(req: Request, res: Response) {
  res.json(await service.inbox(getAuth(req), parse(inboxQuery, req.query)));
}

export async function sent(req: Request, res: Response) {
  res.json(await service.sentMessages(getAuth(req)));
}

export async function send(req: Request, res: Response) {
  res.status(201).json(await service.sendMessage(getAuth(req), parse(sendMessageSchema, req.body)));
}

export async function markRead(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.markRead(getAuth(req), id);
  res.status(204).end();
}

export async function markAllRead(req: Request, res: Response) {
  res.json(await service.markAllRead(getAuth(req)));
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await service.deleteForMe(getAuth(req), id);
  res.status(204).end();
}
