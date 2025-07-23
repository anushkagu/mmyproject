const mongoose = require('mongoose');
const express = require('express');
const ejsMate = require('ejs-mate');
const session = require('express-session')
const ExpressError = require('./utils/ExpressError');
const flash = require('connect-flash');
const path = require('path');
const methodOverride = require('method-override');
const User = require('./models/user');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoDBStore = require('connect-mongo');

if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const dbUrl = process.env.DB_URL



mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const secret = process.env.SECRET || 'fasdfasdfasdfasdfasdf';

const store = new MongoDBStore({
    mongoUrl: dbUrl,
    secret: secret,
    touchAfter: 24 * 60 * 60
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret: secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));
app.use(flash());



app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));


passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next)=>{
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    // console.log(res.locals.currentUser);
    next();
})


const isLoggedIn = (req, res, next)=>{
    if(!req.isAuthenticated()){
        return res.redirect('/register')
    }
    next()
}

app.get('/register', (req, res)=>{
    res.render('users/register');
})

app.post('/register', async (req, res)=>{
    try{const {email, username, currentstatus, linkedin, github, password} = req.body;
    const field = req.body.role;
    const user = new User({email, username, field, currentstatus, linkedin, github});
    const registeredUser = await  User.register(user, password);
    req.login(registeredUser, err => {
        if (err) return next(err);
        req.flash('success', 'Welcome to SeniorCounsel!');
        res.redirect('/');
    })} catch(e){
        req.flash('error', e.message);
        res.redirect('register');
    }
})


app.get('/login', (req, res)=>{
    res.render('users/login');
})

app.post('/login', passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}), (req, res)=>{
    req.flash('success', 'welcome back!');
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
})

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      req.flash('success', "Goodbye!");
      res.redirect('/');
    });
  });

app.get('/', isLoggedIn, (req, res)=>{
    res.render('home');
});

app.get('/fields', isLoggedIn, async (req, res)=>{
    const currentouser =req.user.username
    const fields = await User.find({}).select('field');
    let uniquefields = [];
    var i =0;
    for(field of fields){
        uniquefields[i]= field.field;
        i++;
    }
    uniquefields = [...new Set(uniquefields)]
    res.render('fields',{uniquefields, currentouser});
});



app.get('/fields/:field', isLoggedIn, async(req, res)=>{
    const users = await User.find({field: req.params.field});
    const searchfield =  req.params.field;
    res.render('fields/index', {users, searchfield});      //Curly braces { } are special syntax in JSX. It is used to evaluate a JavaScript expression during compilation
})

app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})


app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err })
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})
