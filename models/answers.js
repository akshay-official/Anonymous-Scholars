const mongoose = require('mongoose');



const answerSchema = new mongoose.Schema({
    body: String,
    date: Date,
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
      }
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
});

const Answer = mongoose.model("Answer", answerSchema);
module.exports = Answer;