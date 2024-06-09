const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  title: String,
  image: {
    type: String,
    default: "https://images.moneycontrol.com/static-hindinews/2024/01/share-market.jpg?impolicy=website&width=770&height=431" // A default placeholder image URL
  },
  description: String,
  date: Date,
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question"
    }
  ],
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;