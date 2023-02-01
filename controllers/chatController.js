const asyncHandler = require("express-async-handler");
const Chat = require("../models/chat");
const User = require("../models/user");
const crypto = require("crypto");

const accessChat = asyncHandler(async (req, res) => {
  const { userId, publicKey } = req.body;
  if (!userId) {
    console.log("UserId params not sent with request");
    return res.sendStatus(400);
  }
  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name pic email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    const pvk = JSON.parse(req.user.privateKey);
    console.log("pvk", pvk);
    const BufferPvk = Buffer.from(pvk.data);
    console.log("BufferPvk", BufferPvk);
    const ecdh = crypto.createECDH("secp521r1");
    ecdh.setPrivateKey(BufferPvk);
    const parsedPbk = JSON.parse(publicKey)
    const BufferPbk = Buffer.from(parsedPbk.data)
    const passphrase = ecdh.computeSecret(BufferPbk).toString("hex");
    console.log("passphrase", passphrase);

    let chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
      passphrase,
    };
    try {
      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).send(fullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

const fetchChats = asyncHandler(async (req, res) => {
  try {
    Chat.find({
      $or: [
        { users: { $elemMatch: { $eq: req.user._id } } },
        { groupAdmin: req.user._id },
      ],
    })
      .populate("users", "-password")
      .populate("latestMessage")
      .populate("groupAdmin", "-password")
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: "latestMessage.sender",
          select: "name pic email",
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please fill all the fields" });
  }
  let users = JSON.parse(req.body.users);
  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }
  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
    });
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const updateGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please fill all the fields" });
  }
  let users = JSON.parse(req.body.users);
  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }
  try {
    const updatedChat = await Chat.findByIdAndUpdate(
      req.params.id,
      {
        chatName: req.body.name,
        users: users,
      },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage");

    const fullGroupChat = await User.populate(updatedChat, {
      path: "latestMessage.sender",
      select: "name pic email",
    });
    if (!fullGroupChat) {
      res.status(404);
      throw new Error("Chat Not Found");
    } else {
      res.json(updatedChat);
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { chatName },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
});

const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: { users: userId },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(added);
  }
});

const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  updateGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
};
