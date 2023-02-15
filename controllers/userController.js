const asyncHandler = require("express-async-handler");
const generateToken = require("../config/generateToken");
const User = require("../models/user");
const crypto = require("crypto");

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, pic } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }
  const ecdh = crypto.createECDH("secp521r1");
  const publicKey = JSON.stringify(ecdh.generateKeys());
  const privateKey = JSON.stringify(ecdh.getPrivateKey());
  console.log("publicKey", publicKey);
  console.log("privateKey", privateKey);
  const user = await User.create({
    name,
    email,
    password,
    pic,
    publicKey,
    privateKey,
  });
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: generateToken(user._id),
      publicKey: user.publicKey,
      privateKey: user.privateKey,
    });
  } else {
    res.status(400);
    throw new Error("Failed to create the user");
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Invalid Email or Password");
  }
});

//api/user?search=john
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};
  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

const updateUser = asyncHandler(async (req, res) => {
  console.log("id", req.params.id);
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
      },
      { new: true }
    );
    if (!updatedUser) {
      res.status(404);
      throw new Error("User Not Found");
    } else {
      res.json(updatedUser);
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { registerUser, authUser, allUsers, updateUser };
