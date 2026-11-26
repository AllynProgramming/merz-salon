import mongoose from "mongoose";

// One document per service that an admin currently has open for editing.
// The _id is the service id, so MongoDB's unique _id index guarantees that
// at most one admin can hold the lock for a given service at a time.
const serviceEditLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    holder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    holderName: {
      type: String,
      default: "",
    },
    // Random per-edit-session token, so the same admin in two tabs is
    // treated as two separate editors.
    token: {
      type: String,
      required: true,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false, collection: "service_edit_locks" },
);

// Let MongoDB clean up abandoned locks. Expiry is also checked in queries,
// because the TTL monitor only runs about once a minute.
serviceEditLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ServiceEditLock =
  mongoose.models.ServiceEditLock ||
  mongoose.model("ServiceEditLock", serviceEditLockSchema);

export default ServiceEditLock;
