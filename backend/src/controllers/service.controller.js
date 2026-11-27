import Service from "../models/service.model.js";
import {
  SERVICE_EDIT_LOCK_HEADER,
  SERVICE_EDIT_LOCK_LEASE_MS,
  acquireServiceEditLock,
  assertCanSaveService,
  assertNotLockedByOthers,
  listActiveServiceLocks,
  releaseServiceEditLock,
} from "../utils/serviceEditLock.js";

const getLockToken = (req) => {
  const token = req.get(SERVICE_EDIT_LOCK_HEADER);
  return typeof token === "string" && token.length <= 100 ? token : "";
};

const lockErrorCodes = new Set([
  "SERVICE_LOCKED",
  "SERVICE_LOCK_EXPIRED",
  "SERVICE_CHANGED",
]);

// Lock conflicts carry a code and the editors' details so the admin page
// can show who is ahead; SERVICE_CHANGED also carries the latest service.
const handleLockError = (error, res, next) => {
  if (lockErrorCodes.has(error.code)) {
    return res.status(error.status).json({
      message: error.message,
      code: error.code,
      ...(error.lock ? { lock: error.lock } : {}),
      ...(error.service ? { service: error.service } : {}),
    });
  }
  return next(error);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getServices = async (req, res, next) => {
  const { category, search, limit } = req.query;
  const filter = { isActive: true };

  if (category) {
    filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  }

  if (search) {
    const searchPattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: searchPattern }, { description: searchPattern }];
  }

  try {
    let serviceQuery = Service.find(filter)
      .select(
        "name description price durationMinutes category averageRating ratingCount",
      )
      .sort({ category: 1, name: 1 });
    if (limit) serviceQuery = serviceQuery.limit(limit);
    const services = await serviceQuery.lean();

    return res.status(200).json({ services });
  } catch (error) {
    return next(error);
  }
};

export const getAdminServices = async (req, res, next) => {
  try {
    const [services, locks] = await Promise.all([
      Service.find({}).sort({ isActive: -1, category: 1, name: 1 }).lean(),
      listActiveServiceLocks(getLockToken(req)),
    ]);

    return res.status(200).json({ services, locks });
  } catch (error) {
    return next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    return res.status(201).json({ message: "Service created.", service });
  } catch (error) {
    return next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const token = getLockToken(req);
    await assertCanSaveService({ service, token });

    Object.assign(service, req.body);
    await service.save();
    // Saving ends this admin's edit session; the next editor in line now
    // has precedence.
    await releaseServiceEditLock({ serviceId: service._id, token });
    return res.status(200).json({ message: "Service updated.", service });
  } catch (error) {
    return handleLockError(error, res, next);
  }
};

export const listServiceLocks = async (req, res, next) => {
  try {
    const locks = await listActiveServiceLocks(getLockToken(req));
    return res.status(200).json({ locks });
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/services/:id/lock: open the service for editing, or renew
// (heartbeat) when the caller sends its token in the X-Edit-Lock-Token header.
// Any number of admins can open it; the response says where the caller is in
// line. Only the first in line can save.
export const lockService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id)
      .select("updatedAt")
      .lean();
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const { token, lock } = await acquireServiceEditLock({
      serviceId: req.params.id,
      user: req.user,
      token: getLockToken(req),
      serviceUpdatedAt: service.updatedAt,
    });
    return res.status(200).json({
      token,
      lock,
      leaseMs: SERVICE_EDIT_LOCK_LEASE_MS,
    });
  } catch (error) {
    return handleLockError(error, res, next);
  }
};

// DELETE /api/v1/services/:id/lock: stop editing. Removes only the caller's
// own entry, identified by its token.
export const unlockService = async (req, res, next) => {
  try {
    const token = getLockToken(req);
    if (token) {
      await releaseServiceEditLock({ serviceId: req.params.id, token });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};

export const archiveService = async (req, res, next) => {
  try {
    await assertNotLockedByOthers({
      serviceId: req.params.id,
      token: getLockToken(req),
    });
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: { isActive: false } },
      { new: true, runValidators: true },
    );
    if (!service) {
      return res.status(404).json({ message: "Active service not found." });
    }

    return res.status(200).json({ message: "Service archived.", service });
  } catch (error) {
    return handleLockError(error, res, next);
  }
};

export const restoreService = async (req, res, next) => {
  try {
    await assertNotLockedByOthers({
      serviceId: req.params.id,
      token: getLockToken(req),
    });
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, isActive: false },
      { $set: { isActive: true } },
      { new: true, runValidators: true },
    );
    if (!service) {
      return res.status(404).json({ message: "Archived service not found." });
    }

    return res.status(200).json({ message: "Service restored.", service });
  } catch (error) {
    return handleLockError(error, res, next);
  }
};

export const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .select(
        "name description price durationMinutes category averageRating ratingCount",
      )
      .lean();

    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    return res.status(200).json({ service });
  } catch (error) {
    return next(error);
  }
};
