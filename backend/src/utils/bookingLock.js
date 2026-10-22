import { randomUUID } from "node:crypto";

import BookingLock from "../models/bookingLock.model.js";

const lockLeaseMilliseconds = 2 * 60 * 1000;
const lockWaitMilliseconds = 10 * 1000;
const retryIntervalMilliseconds = 50;

const toDateKey = (date) =>
  date instanceof Date ? date.toISOString().slice(0, 10) : date;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const acquireDateLock = async (dateKey) => {
  const lockId = `appointment-date:${dateKey}`;
  const owner = randomUUID();
  const deadline = Date.now() + lockWaitMilliseconds;

  while (Date.now() < deadline) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + lockLeaseMilliseconds);
    const reclaimedLock = await BookingLock.findOneAndUpdate(
      { _id: lockId, expiresAt: { $lte: now } },
      { $set: { owner, expiresAt } },
      { new: true },
    );

    if (reclaimedLock) {
      return { lockId, owner };
    }

    try {
      await BookingLock.create({ _id: lockId, owner, expiresAt });
      return { lockId, owner };
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }

    await wait(retryIntervalMilliseconds);
  }

  throw Object.assign(
    new Error("This date is busy being booked. Please try again."),
    { status: 409 },
  );
};

export const withBookingDateLocks = async (dates, operation) => {
  const dateKeys = [...new Set(dates.map(toDateKey))].sort();
  const locks = [];

  try {
    for (const dateKey of dateKeys) {
      locks.push(await acquireDateLock(dateKey));
    }

    return await operation();
  } finally {
    for (const lock of locks.reverse()) {
      try {
        await BookingLock.deleteOne({ _id: lock.lockId, owner: lock.owner });
      } catch (error) {
        console.error("Failed to release appointment booking lock:", error);
      }
    }
  }
};

export const withBookingDateLock = (date, operation) =>
  withBookingDateLocks([date], operation);
