import mongoose from "mongoose";

// One admin who has a service's edit form open.
const editorSchema = new mongoose.Schema(
  {
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
    // When this admin opened the edit form. Earlier means higher precedence.
    openedAt: {
      type: Date,
      required: true,
    },
    // The editor leaves the queue if no heartbeat renews this in time.
    expiresAt: {
      type: Date,
      required: true,
    },
    // The service's updatedAt when this admin's form was loaded, so a save
    // can tell whether someone ahead of them changed the service meanwhile.
    baseUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

// One document per service that has at least one admin editing it. The
// editors array is kept in the order the admins opened the form: the first
// active editor has precedence and is the only one allowed to save.
const serviceEditLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    editors: {
      type: [editorSchema],
      default: [],
    },
    // Latest expiry among the editors, so MongoDB can drop abandoned
    // documents. Expiry is also checked per editor in every query.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false, collection: "service_edit_locks" },
);

serviceEditLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ServiceEditLock =
  mongoose.models.ServiceEditLock ||
  mongoose.model("ServiceEditLock", serviceEditLockSchema);

export default ServiceEditLock;
