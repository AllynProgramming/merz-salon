import { randomUUID } from "node:crypto";

import ServiceEditLock from "../models/serviceEditLock.model.js";

// How long an editor stays in the queue without a heartbeat. The admin page
// renews it every few seconds while the edit form is open.
export const SERVICE_EDIT_LOCK_LEASE_MS = 60 * 1000;
export const SERVICE_EDIT_LOCK_HEADER = "x-edit-lock-token";

const getDisplayName = (user) =>
  user?.name ||
  [user?.firstname, user?.lastname].filter(Boolean).join(" ") ||
  user?.email ||
  "Another admin";

const formatTime = (date) =>
  new Intl.DateTimeFormat("en-PH", {
    timeStyle: "short",
    timeZone: process.env.SALON_TIMEZONE || "Asia/Manila",
  }).format(date);

// Active editors in order of precedence: whoever opened the form first.
// Array order breaks ties, since editors are appended as they join.
const activeEditors = (doc, now = new Date()) =>
  (doc?.editors || [])
    .map((editor, index) => ({ editor, index }))
    .filter(({ editor }) => new Date(editor.expiresAt) > now)
    .sort(
      (first, second) =>
        new Date(first.editor.openedAt) - new Date(second.editor.openedAt) ||
        first.index - second.index,
    )
    .map(({ editor }) => editor);

// What the admin page is allowed to see: names, times and order, never the
// other editors' tokens.
const toPublicLock = (editors, token) => {
  const [first] = editors;
  const mine = editors.findIndex((editor) => token && editor.token === token);
  return {
    holderName: first.holderName,
    openedAt: first.openedAt,
    isMine: mine === 0,
    position: mine === -1 ? null : mine + 1,
    editors: editors.map((editor, index) => ({
      holderName: editor.holderName,
      openedAt: editor.openedAt,
      position: index + 1,
      isMine: Boolean(token) && editor.token === token,
    })),
  };
};

const lockError = (status, code, message, extra = {}) =>
  Object.assign(new Error(message), { status, code, ...extra });

const expiredError = () =>
  lockError(
    409,
    "SERVICE_LOCK_EXPIRED",
    "Your editing session for this service expired. Open it for editing again.",
  );

const findLockDoc = (serviceId) =>
  ServiceEditLock.findById(String(serviceId)).lean();

const pruneExpired = (serviceId, now) =>
  ServiceEditLock.updateOne(
    { _id: String(serviceId) },
    { $pull: { editors: { expiresAt: { $lte: now } } } },
  );

/**
 * Open a service for editing, or renew your place when `token` is the
 * token you were given. Every admin can open the form; each one is added to
 * the service's editors array with the time they opened it, and the
 * earliest one has precedence.
 */
export const acquireServiceEditLock = async ({
  serviceId,
  user,
  token,
  serviceUpdatedAt,
}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SERVICE_EDIT_LOCK_LEASE_MS);
  await pruneExpired(serviceId, now);

  if (token) {
    // Heartbeat: renew only an entry that is still active. An entry that
    // already expired has lost its place in the queue.
    const doc = await ServiceEditLock.findOneAndUpdate(
      {
        _id: String(serviceId),
        editors: { $elemMatch: { token, expiresAt: { $gt: now } } },
      },
      {
        $set: { "editors.$.expiresAt": expiresAt },
        $max: { expiresAt },
      },
      { new: true, lean: true },
    );
    if (!doc) throw expiredError();
    return { token, lock: toPublicLock(activeEditors(doc, now), token) };
  }

  const newToken = randomUUID();
  const editor = {
    holder: user._id,
    holderName: getDisplayName(user),
    token: newToken,
    openedAt: now,
    expiresAt,
    baseUpdatedAt: serviceUpdatedAt || null,
  };
  const join = () =>
    ServiceEditLock.findOneAndUpdate(
      { _id: String(serviceId) },
      { $push: { editors: editor }, $max: { expiresAt } },
      { upsert: true, new: true, lean: true },
    );

  let doc;
  try {
    doc = await join();
  } catch (error) {
    // Two admins created the document at the same moment: the other insert
    // won, so this one now joins the existing document instead.
    if (error.code !== 11000) throw error;
    doc = await join();
  }
  return { token: newToken, lock: toPublicLock(activeEditors(doc, now), newToken) };
};

export const releaseServiceEditLock = ({ serviceId, token }) =>
  ServiceEditLock.updateOne(
    { _id: String(serviceId) },
    { $pull: { editors: { token } } },
  );

/**
 * For "save": the caller must be the active editor who opened the form
 * first, and the service must not have changed since their form loaded.
 */
export const assertCanSaveService = async ({ service, token }) => {
  const now = new Date();
  const editors = activeEditors(await findLockDoc(service._id), now);
  const mine = editors.find((editor) => token && editor.token === token);
  if (!mine) throw expiredError();

  const [first] = editors;
  if (first.token !== token) {
    throw lockError(
      423,
      "SERVICE_LOCKED",
      `${first.holderName || "Another admin"} opened this service first at ${formatTime(new Date(first.openedAt))} and takes precedence. You can save once they finish.`,
      { lock: toPublicLock(editors, token) },
    );
  }

  const base = mine.baseUpdatedAt ? new Date(mine.baseUpdatedAt) : null;
  const current = service.updatedAt ? new Date(service.updatedAt) : null;
  if (base && current && current > base) {
    // Someone ahead of this admin saved while they waited. Show them the
    // new version once; their next save goes through.
    await ServiceEditLock.updateOne(
      { _id: String(service._id), "editors.token": token },
      { $set: { "editors.$.baseUpdatedAt": current } },
    );
    throw lockError(
      409,
      "SERVICE_CHANGED",
      "Another admin saved changes to this service while you were waiting. The form now shows their version. Review it and save again.",
      { service },
    );
  }
};

/**
 * For archive/restore: allowed only when no other admin has the service
 * open for editing.
 */
export const assertNotLockedByOthers = async ({ serviceId, token }) => {
  const editors = activeEditors(await findLockDoc(serviceId));
  const other = editors.find((editor) => editor.token !== token);
  if (other) {
    throw lockError(
      423,
      "SERVICE_LOCKED",
      `${other.holderName || "Another admin"} is currently editing this service. Try again once they finish.`,
      { lock: toPublicLock(editors, token) },
    );
  }
};

export const listActiveServiceLocks = async (token) => {
  const now = new Date();
  const docs = await ServiceEditLock.find({
    "editors.expiresAt": { $gt: now },
  }).lean();
  return Object.fromEntries(
    docs
      .map((doc) => [doc._id, activeEditors(doc, now)])
      .filter(([, editors]) => editors.length > 0)
      .map(([id, editors]) => [id, toPublicLock(editors, token)]),
  );
};
