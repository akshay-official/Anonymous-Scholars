const mongoose = require("mongoose");
const passportLocalMongoose = require('passport-local-mongoose');
const userSchema = new mongoose.Schema({
    // name : {
    //     type : String,
    //     required : true
    // },
    email : {
        type : String,
        required : true
    },
    college : {
        type : String,
        required : true
    },
    course : {
        type : String,
        required : true
    },
    batch : {
        type : Number,
        required : true
    },
    groups: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Group"
        }
      ],
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
module.exports = User;