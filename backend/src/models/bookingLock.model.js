import mongoose from "mongoose";

const bookingLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false, collection: "booking_locks" },
);

const BookingLock =
  mongoose.models.BookingLock ||
  mongoose.model("BookingLock", bookingLockSchema);

export default BookingLock;
