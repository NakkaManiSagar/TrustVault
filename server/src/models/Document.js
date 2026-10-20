
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 150,
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "General",
        "Academic",
        "Identity",
        "Finance",
        "Medical",
        "Other",
      ],
      default: "General",
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    mimeType: {
      type: String,
      required: true,
      maxlength: 150,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ title: "text", originalName: "text" });
documentSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model("Document", documentSchema);
