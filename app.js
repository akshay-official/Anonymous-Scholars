if (process.env.NODE_ENV != "production") {
    require('dotenv').config();
}

const express = require('express');
const path = require("path");
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const Group = require('./models/groups');
const Question = require('./models/questions');
const Comment = require('./models/comments');
const Answer = require('./models/answers');
const User = require('./models/users');
const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const expressError = require("./expressError");
const { group } = require('console');
const { deserialize } = require('v8');
const multer = require('multer');
const { storage } = require('./cloudConfig');
const upload = multer({ storage });
const MongoStore = require('connect-mongo');


const app = express();
const port = 8080;

const store = MongoStore.create({
    mongoUrl: process.env.dbUrl,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});
store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
}


app.listen(port, () => {
    console.log(`app is listening at ${port}`);
})

mongoose.connect(process.env.dbUrl)
  .then(() => console.log('Connected!'));

function isLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.session.question = req.body;
        req.session.answer = req.body;
        req.session.comment = req.body;
        return res.redirect("/login");
    }
    next();
}
async function isOwner(req, res, next) {
    const group = await Group.findById(req.params.id);
    if (!req.user || !req.user._id.equals(group.owner._id))
        return res.redirect(`/groups/${req.params.id}`);
    next();
}

async function isQuestionAuthor(req, res, next) {
    const question = await Question.findById(req.params.questionId);
    if (!req.user || !req.user._id.equals(question.author._id))
        return res.redirect(`/groups/${req.params.id}`);
    next();
}
async function isAnswerAuthor(req, res, next) {
    const answer = await Answer.findById(req.params.answerId);
    if (!req.user || !req.user._id.equals(answer.author._id))
        return res.redirect(`/groups/${req.params.id}/questions/${req.params.questionId}`);
    next();
}
async function isCommentAuthor(req, res, next) {
    const comment = await Comment.findById(req.params.commentId);
    if (!req.user || !req.user._id.equals(comment.author._id))
        return res.redirect(`/groups/${req.params.id}/questions/${req.params.questionId}`);
    next();
}
function saveRedirectUrl(req, res, next) {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
        res.locals.question = req.session.question;
        res.locals.answer = req.session.answer;
        res.locals.comment = req.session.comment;
        // console.log(req.session);
    }
    next();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(methodOverride('_method'));
app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function wrapAsync(fn) {
    return function (req, res, next) {
        fn(req, res, next).catch((err) => { next(err) });
    }
};
app.use((req, res, next) => {
    res.locals.currUser = req.user;
    // console.log(req.user);
    next();
})

function isJoined(req, res, next) {
    for (let i = 0; i < req.user.groups.length; i++) {
        if (req.params.id.toString() === req.user.groups[i].toString()) res.redirect("/");
    }
    next();
}

function isJoined2(g, id) {
    for (let i = 0; i < g.length; i++) {
        if (id.toString() === g[i].toString()) return true;
    }
    return false;
}
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}
app.get("/", (req, res) => {
    res.redirect("/groups");
})
app.post("/search", async (req, res) => {
    // console.log(req.body);
    const groups = await Group.find({ title: { "$regex": req.body.title, "$options": "i" } }).populate("owner");
    res.render("./groups/groups.ejs", { groups, isJoined2 });
})
app.get("/test", (req, res) => {
    // const users = 
    // res.redirect("/groups");
    // console.log("ok");
    res.render("./groups/tttt.ejs");
})

//Users ROUTES
app.get("/details", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id);
    res.render("./users/show.ejs", { user });
})
app.get("/users/:userId", async (req, res) => {
    const user = await User.findById(req.params.userId);
    console.log(user);
    res.render("./users/show.ejs", { user });
    // res.send("ok");
})
app.get("/signup", (req, res) => {
    res.render("users/signup.ejs");
});
app.post("/signup", wrapAsync(async (req, res) => {
    let user = new User({
        // name: req.body.name,
        email: req.body.email,
        username: req.body.username,
        college: req.body.college,
        course: req.body.course,
        batch: req.body.batch
    });
    const output = await User.register(user, req.body.password);
    console.log(output);
    req.login(output, (err) => {
        if (err) {
            return next(err);
        }
        console.log(output);
        res.redirect("/groups");
    });

}));
app.get("/login", (req, res) => {
    // res.send('ok')
    res.render("users/login.ejs");
});
app.post("/login", saveRedirectUrl,
    passport.authenticate("local", { failureRedirect: "/login" }),
    (req, res) => {
        let redirectUrl = res.locals.redirectUrl;
        req.session.question = res.locals.question;
        req.session.answer = res.locals.answer;
        req.session.comment = res.locals.comment;
        if (!redirectUrl) redirectUrl = "/groups";
        res.redirect(redirectUrl);
    });
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect("/groups");
    });
})















//Groups ROUTES
app.get("/groups/mygroups", isLoggedIn, wrapAsync(async (req, res) => {

    // const updateUser = req.user;
    // updateUser.groups.push(req.params.id);
    // await updateUser.save();
    const groups = [];
    for (let i = 0; i < req.user.groups.length; i++) {
        const group = await Group.findById(req.user.groups[i]).populate("owner");
        groups.push(group);
    }
    // const updateUser = req.user;
    // updateUser.groups.push(req.params.id);
    // await updateUser.save();
    // res.render(groups);
    res.render("./groups/groups.ejs", { groups, isJoined2 });
}));
app.get("/groups", wrapAsync(async (req, res) => {
    const groups = await Group.find({}).populate("owner");
    // console.log(groups);
    res.render("./groups/groups.ejs", { groups, isJoined2 });
}));
app.get("/groups/new", isLoggedIn, (req, res) => {
    // res.send("ok")
    res.render("./groups/new.ejs");
})
app.get("/groups/:id", wrapAsync(async (req, res) => {
    // const group = await Group.findById(req.params.id).populate({
    //     path: "questions", populate: {
    //         path: "answers", populate: {
    //             path: "comments"
    //         }
    //     }
    // }).populate("owner");

    const group = await Group.findById(req.params.id).populate({
        path: "questions", populate: {
            path: "author"
        }
    }).populate("owner");
    res.render("./groups/group.ejs", { group, isJoined2, formatDate });
    // res.render("./groups/test.ejs", { group });
}));
app.get("/groups/:id/join", isLoggedIn, isJoined, wrapAsync(async (req, res) => {
    // const group = await Group.findById(req.params.id);
    // group.members.push(req.user);
    // group.save();
    // // res.render("./groups/group.ejs", { group });
    // // console.log(req.user);
    // // res.send("ok");
    const updateUser = req.user;
    updateUser.groups.push(req.params.id);
    await updateUser.save();
    res.redirect("/groups");
}));

app.post("/groups", upload.single('image'), isLoggedIn, (req, res) => {
    const currentDate = new Date();
    const group = new Group({
        title: req.body.title,
        image: (req.file) ? req.file.path : 'https://res.cloudinary.com/dlqlfugc5/image/upload/v1717691794/Anonymous-Scholars/computed-filename-using-request.jpg',
        description: req.body.description,
        date: currentDate
    });
    group.owner = req.user._id;
    console.log(group);
    group.save();
    res.redirect("/groups");
    // res.send(req.file);
})
app.get("/groups/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const group = await Group.findById(req.params.id);
    res.render("./groups/edit.ejs", { group });
}))
app.put("/groups/:id", upload.single('image'), isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const group = await Group.findById(req.params.id);
    // console.log(" path is" + req.file);
    const groupUpdate = {
        title: req.body.title,
        image: (req.file) ? req.file.path : group.image,
        description: req.body.description
    };
    await Group.findByIdAndUpdate(req.params.id, groupUpdate);
    res.redirect(`/groups/${req.params.id}`);//efnfuweuf
}));
app.delete("/groups/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    await Group.findByIdAndDelete(req.params.id);
    res.redirect("/groups");
}))




//Questions ROUTES
app.get("/groups/:id/questions/:questionId", async (req, res) => {
    let question = await Question.findById(req.params.questionId).populate({
        path: 'answers',
        populate: {
            path: 'author'
        }
    }).populate({
        path: "answers", populate: {
            path: "comments", populate: {
                path: 'author'
            }
        }
    }).populate("author");
    // res.render("./questions/question.ejs", { question, groupId: req.params.id });
    // console.log(question);
    // res.render("./groups/tt.ejs", { question, groupId: req.params.id });
    // res.send('ok');
    res.render("./questions/question.ejs", { question, groupId: req.params.id, formatDate });
})
// app.get("/groups/:id/questions/new", isLoggedIn, (req, res) => {
//     res.render("./questions/new.ejs", { groupId: req.params.id });
// });
app.get("/groups/:id/questions", isLoggedIn, wrapAsync(async (req, res) => {
    console.log(req.session.question);
    if (req.session.question) {
        const currentDate = new Date();
        const question = new Question({
            body: req.session.question.body,
            date: currentDate
        })
        question.author = req.user._id;
        await question.save();
        const group = await Group.findById(req.params.id);
        group.questions.push(question);
        group.save();
        req.session.question = null;
    }
    res.redirect(`/groups/${req.params.id}`);
}))

app.post("/groups/:id/questions", isLoggedIn, wrapAsync(async (req, res) => {
    const currentDate = new Date();
    const question = new Question({
        body: req.body.body,
        date: currentDate
    })
    question.author = req.user._id;
    await question.save();
    const group = await Group.findById(req.params.id);
    group.questions.push(question);
    group.save();
    res.redirect(`/groups/${req.params.id}`);
}))
app.get("/groups/:id/questions/:questionId/edit", isLoggedIn, isQuestionAuthor, wrapAsync(async (req, res, next) => {
    const question = await Question.findById(req.params.questionId);
    res.render("questions/edit.ejs", { question, groupId: req.params.id });
    // res.send("ok");
}));
app.put("/groups/:id/questions/:questionId", isLoggedIn, isQuestionAuthor, wrapAsync(async (req, res) => {
    const question = {
        body: req.body.body
    };
    console.log("i a,")
    await Question.findByIdAndUpdate(req.params.questionId, question);
    res.redirect(`/groups/${req.params.id}/questions/${req.params.questionId}`);
}));
app.delete("/groups/:id/questions/:questionId", isLoggedIn, isQuestionAuthor, wrapAsync(async (req, res) => {
    await Question.findByIdAndDelete(req.params.questionId);
    res.redirect(`/groups/${req.params.id}`);
}))







//Answer ROUTES
// app.get("/groups/:id/questions/:questionId/answers/new", isLoggedIn, (req, res) => {
//     res.render("./answers/new.ejs", { groupId: req.params.id, questionId: req.params.questionId });
// })
app.get("/groups/:id/questions/:questionId/answers", isLoggedIn, async (req, res) => {
    // console.log(req.session.answer);
    // console.log(req.session.question);
    // console.log(req.session);
    // res.send("ok");
    if (req.session.answer) {
        const currentDate = new Date();
        const answer = new Answer({
            body: req.session.answer.body,
            date: currentDate
        });
        answer.author = req.user._id;
        await answer.save();
        let question = await Question.findById(req.params.questionId);
        question.answers.push(answer);
        await question.save();
        req.session.answer = null;
    }
    res.redirect(`/groups/${req.params.id}/questions/${req.params.questionId}`);
})
app.post("/groups/:id/questions/:questionId/answers", isLoggedIn, async (req, res) => {
    const currentDate = new Date();
    const answer = new Answer({
        body: req.body.body,
        date: currentDate
    });
    answer.author = req.user._id;
    await answer.save();
    let question = await Question.findById(req.params.questionId);
    question.answers.push(answer);
    await question.save();
    res.redirect(`/groups/${req.params.id}/questions/${req.params.questionId}`);
})
app.get("/groups/:id/questions/:questionId/answers/:answerId/edit", isLoggedIn, isAnswerAuthor, wrapAsync(async (req, res) => {
    const answer = await Answer.findById(req.params.answerId);
    const ID = req.params.id;
    res.render("answers/edit.ejs", { answer, groupId: req.params.id, questionId: req.params.questionId });
}));
app.put("/groups/:id/questions/:questionId/answers/:answerId", isLoggedIn, isAnswerAuthor, wrapAsync(async (req, res) => {
    const answer = {
        body: req.body.body
    };
    await Answer.findByIdAndUpdate(req.params.answerId, answer);
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
}));
app.delete("/groups/:id/questions/:questionId/answers/:answerId", isLoggedIn, isAnswerAuthor, wrapAsync(async (req, res) => {
    let answer = await Answer.findByIdAndDelete(req.params.answerId);
    let question = await Question.findById(req.params.questionId);
    const index = question.answers.indexOf(req.params.answerId);
    if (index > -1) {
        question.answers.splice(index, 1);
    }
    question.save();
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
}));






//Comments Routes
app.get("/groups/:id/questions/:questionId/answers/:answerId/comments/new", isLoggedIn, (req, res) => {
    res.render("comments/new.ejs", { groupId: req.params.id, questionId: req.params.questionId, answerId: req.params.answerId });
});
app.get("/groups/:id/questions/:questionId/answers/:answerId/comments", isLoggedIn, async (req, res) => {
    if (req.session.comment) {
        const currentDate = new Date();
        const comment = new Comment({
            body: req.session.comment.body,
            date: currentDate
        });
        comment.author = req.user._id;
        await comment.save();
        const answer = await Answer.findById(req.params.answerId);
        answer.comments.push(comment);
        await answer.save();
        req.session.comment = null;
    }
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
});
app.post("/groups/:id/questions/:questionId/answers/:answerId/comments", isLoggedIn, async (req, res) => {
    const currentDate = new Date();
    const comment = new Comment({
        body: req.body.body,
        date: currentDate
    });
    comment.author = req.user._id;
    await comment.save();
    const answer = await Answer.findById(req.params.answerId);
    answer.comments.push(comment);
    await answer.save();
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
});
app.get("/groups/:id/questions/:questionId/answers/:answerId/comments/:commentId/edit", isLoggedIn, isCommentAuthor, wrapAsync(async (req, res) => {
    const comment = await Comment.findById(req.params.commentId);
    res.render("comments/edit.ejs", { comment, groupId: req.params.id, questionId: req.params.questionId, answerId: req.params.answerId });
}));
app.put("/groups/:id/questions/:questionId/answers/:answerId/comments/:commentId", isLoggedIn, isCommentAuthor, wrapAsync(async (req, res) => {
    const comment = {
        body: req.body.body
    };
    await Comment.findByIdAndUpdate(req.params.commentId, comment);
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
}));
app.delete("/groups/:id/questions/:questionId/answers/:answerId/comments/:commentId", isLoggedIn, isCommentAuthor, wrapAsync(async (req, res) => {
    let comment = await Comment.findByIdAndDelete(req.params.commentId);
    let answer = await Answer.findById(req.params.answerId);
    const index = answer.comments.indexOf(req.params.commentId);
    if (index > -1) {
        answer.comments.splice(index, 1);
    }
    answer.save();
    res.redirect(`/groups/${req.params.groupId}/questions/${req.params.questionId}`);
}));

//Others ROUTES
app.all("*", (req, res, next) => {
    try {
        throw new expressError(404, "The requested URL was not found");
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    // console.log("i am here");
    let status = err.status;
    if (!status)
        status = 404;
    let message = err.message;
    res.render("error/error.ejs", { status, message });
});
