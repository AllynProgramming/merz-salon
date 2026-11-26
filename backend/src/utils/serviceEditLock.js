import { randomUUID } from "node:crypto";

import ServiceEditLock from "../models/serviceEditLock.model.js";

// How long a lock lives without a heartbeat. The admin page renews it
// every 20 seconds while the edit form is open.
export const SERVICE_EDIT_LOCK_LEASE_MS = 60 * 1000;
export const SERVICE_EDIT_LOCK_HEADER = "x-edit-lock-token";

const getDisplayName = (user) =>
  user?.name ||
  [user?.firstname, user?.lastname].filter(Boolean).join(" ") ||
  user?.email ||
  "Another admin";

const toPublicLock = (lock, token) => ({
  holderName: lock.holderName,
  acquiredAt: lock.acquiredAt,
  expiresAt: lock.expiresAt,
  isMine: Boolean(token) && lock.token === token,
});

export const lockedError = (lock, userId) => {
  const sameUser = String(lock.holder) === String(userId);
  return Object.assign(
    new Error(
      sameUser
        ? "You are already editing this service in another tab or window."
        : `${lock.holderName || "Another admin"} is currently editing this service. Try again once they finish.`,
    ),
    { status: 423, code: "SERVICE_LOCKED", lock: toPublicLock(lock) },
  );
};

export const findActiveLock = (serviceId) =>
  ServiceEditLock.findOne({
    _id: String(serviceId),
    expiresAt: { $gt: new Date() },
  }).lean();

/**
 * Acquire the edit lock for a service, or renew it if `token` is the
 * caller's current lock token. Atomic: the filter only matches a lock that
 * has expired or that the caller already holds; otherwise the upsert
 * collides with the existing _id and we report who holds it.
 */
export const acquireServiceEditLock = async ({ serviceId, user, token }) => {
  const now = new Date();
  const lockToken = token || randomUUID();
  const expiresAt = new Date(now.getTime() + SERVICE_EDIT_LOCK_LEASE_MS);
  const ownershipFilter = token
    ? { $or: [{ expiresAt: { $lte: now } }, { token }] }
    : { expiresAt: { $lte: now } };

  try {
    const lock = await ServiceEditLock.findOneAndUpdate(
      { _id: String(serviceId), ...ownershipFilter },
      {
        $set: {
          holder: user._id,
          holderName: getDisplayName(user),
          token: lockToken,
          expiresAt,
          // A renewal keeps the original start time; a new holder starts fresh.
          ...(token ? {} : { acquiredAt: now }),
        },
        ...(token ? { $setOnInsert: { acquiredAt: now } } : {}),
      },
      { upsert: true, new: true, lean: true },
    );

    return { token: lockToken, lock: toPublicLock(lock, lockToken) };
  } catch (error) {
    if (error.code !== 11000) throw error;

    const existing = await findActiveLock(serviceId);
    if (!existing) {
      // The other lock expired between our attempt and the lookup.
      return acquireServiceEditLock({ serviceId, user, token });
    }
    throw lockedError(existing, user._id);
  }
};

export const releaseServiceEditLock = ({ serviceId, token }) =>
  ServiceEditLock.deleteOne({ _id: String(serviceId), token });

/**
 * For writes: the caller must currently hold the lock. Used by "save".
 */
export const assertHoldsServiceEditLock = async ({ serviceId, user, token }) => {
  const lock = await findActiveLock(serviceId);
  if (lock && token && lock.token === token) return;
  if (lock) throw lockedError(lock, user._id);

  throw Object.assign(
    new Error(
      "Your editing session for this service expired. Open it for editing again.",
    ),
    { status: 409, code: "SERVICE_LOCK_EXPIRED" },
  );
};

/**
 * For archive/restore: allowed when nobody else is editing the service.
 */
export const assertNotLockedByOthers = async ({ serviceId, user, token }) => {
  const lock = await findActiveLock(serviceId);
  if (lock && !(token && lock.token === token)) {
    throw lockedError(lock, user._id);
  }
};

export const listActiveServiceLocks = async (token) => {
  const locks = await ServiceEditLock.find({
    expiresAt: { $gt: new Date() },
  }).lean();
  return Object.fromEntries(
    locks.map((lock) => [lock._id, toPublicLock(lock, token)]),
  );
};
