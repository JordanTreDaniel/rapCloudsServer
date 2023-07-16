import express from "express";
var router = express.Router();
import User from "../db/models/User";

const updateUser = async (req, res, next) => {
  try {
    const { user: userUpdates } = req.body;

    // Verify that we have a user to update
    if (!userUpdates || !userUpdates._id) {
      return res
        .status(400)
        .json({ message: "No user data provided for update." });
    }

    // Perform the update and get the updated document
    const updatedUser = await User.findByIdAndUpdate(
      userUpdates._id,
      userUpdates,
      { new: true }
    ).exec();

    // If no user found, return a specific error message
    if (!updatedUser) {
      return res
        .status(404)
        .json({ message: `User with id ${userUpdates._id} not found.` });
    }

    // Otherwise, return the updated user
    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.log("Failed to update user:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while updating the user." });
  }
};

router.post("/updateUser", updateUser);

export default router;
