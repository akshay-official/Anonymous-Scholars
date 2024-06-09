const mongoose = require('mongoose');
const initData = require('./data');
const Group = require('../models/groups');
mongoose.connect('mongodb://127.0.0.1:27017/mainDB')
  .then(() => console.log('Connected!'));


  const inintDB = async () => {
    await Group.deleteMany({});
    await Group.insertMany(initData.data);
    console.log("ok");
  }

  inintDB();