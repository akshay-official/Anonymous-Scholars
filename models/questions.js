const mongoose = require('mongoose');


const questionSchema = new mongoose.Schema({
  body: String,
  date: Date,
  answers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Answer"
    }
  ],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const Question = mongoose.model("Question", questionSchema);
module.exports = Question;