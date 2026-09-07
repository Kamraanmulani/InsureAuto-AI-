const mongoose = require("mongoose");
const User = require("../models/User");

const seedInitialUsers = async () => {
  try {
    const adminExists = await User.findOne({ role: "ADMIN" });
    if (!adminExists) {
      const admin = new User({
        email: "admin@claimsight.internal",
        password: "AdminPassword@123",
        name: "System Administrator",
        role: "ADMIN"
      });
      await admin.save();
    }

    const assessorExists = await User.findOne({ email: "assessor@claimsight.internal" });
    if (!assessorExists) {
      const assessor = new User({
        email: "assessor@claimsight.internal",
        password: "Password@123",
        name: "Sarah Jenkins",
        role: "ASSESSOR"
      });
      await assessor.save();
    }
  } catch (err) {
    console.error("Initial user seed error:", err.message);
  }
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/insurance_claims";
  try {
    const conn = await mongoose.connect(mongoUri);
    await seedInitialUsers();
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
