'use strict';

const utils = require("../../utils.js");
const g_constants = require("../../constants.js");

const mailer = require("../mailer.js");

let emailChecker = {};

exports.onSubmit = async function(req, res)
{
    try {
        
        if (g_constants.share.recaptchaEnabled)
            await utils.validateRecaptcha(req);
            
        await validateForm(req);
        
        try {
            const ret = await utils.CheckUserExist(req.body['username'], req.body['email']);
            return SignupError(req, res, ret.message);
        }
        catch(e) {
            if (g_constants.share.emailVerificationEnabled == 'disabled') return await Signup(req, res);

            return await Signup(req, res);
        }
    }
    catch(e) {
        return SignupError(req, res, e.message);
    }

    function validateForm(req)
    {
        return new Promise((ok, cancel) => {
            if (!req.body || !req.body['username'] || !req.body['email'] || !req.body['password1'] || !req.body['password2'])
                return cancel(new Error('Bad Request'));
    
            if (req.body['password1'] != req.body['password2'])
                return cancel(new Error('The two password fields didn\'t match.'));
    
            if (!utils.ValidateEmail(req.body['email']))
                return cancel(new Error('Ivalid email'));
    
            ok('');
        });
    }
}

exports.onCheckEmail = function(req, res)
{
    const strCheck = req.url.substr(req.url.indexOf('/', 1)+1);
    
    console.log(strCheck);
    console.log(JSON.stringify(emailChecker));
    
    if (!emailChecker[strCheck] || !emailChecker[strCheck].body)
        return utils.render(res, 'pages/registration/signup_confirm', {error: true, message: 'Invalid confirmation link.'})

    req['body'] = emailChecker[strCheck].body;
    Signup(req, res);
}

async function Signup(req, res)
{
    const user = req.body['username'];
    const email = req.body['email'];
    const password = utils.HashPassword(req.body['password1']);
    
    const IP = escape(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    
    try {
        const ret = await utils.CheckUserExist(user, email);
        
        SignupError(req, res, ret.message);
    }
    catch(e) {
        InsertNewUser(user, email, password, res, IP);
        SignupSuccess(req, res, {});
    }
}

function InsertNewUser(user, email, password, res, IP)
{
    const info = JSON.stringify({});
    g_constants.dbTables['users'].insert(user, email, password, info, err => {
        if (err)
            return utils.render(res, 'pages/registration/signup_confirm', {error: true, message: 'Something wrong (( Please try again. ('+(err.message || JSON.stringify(err))+')'});
            

        g_constants.dbTables['users'].selectAll('ROWID AS id, *', 'login="'+escape(user)+'" AND email="'+escape(email)+'"', '', (err, rows) => {
            if (err || !rows || rows.length != 1)
                return;
                
            return utils.UpdateRef(IP, rows[0].id);
        });
    });
}

function SignupSuccess(request, responce, message)
{
    utils.renderJSON(request, responce, {result: true, message: message, redirect: request.body['redirect'] || "/login"});
}

function SignupError(request, responce, message)
{
    utils.renderJSON(request, responce, {result: false, message: message});
}