import AccessControl from '../accessControl.js';
import Gmail from "../gmail.js";
import Like from '../models/like.js';
import Post from '../models/post.js';
import Repository from '../models/repository.js';
import UserModel from '../models/user.js';
import TokenManager from '../tokensManager.js';
import * as utilities from "../utilities.js";
import Controller from './Controller.js';

export default class AccountsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new UserModel()), AccessControl.admin());
    }
    index(id) {
        if (id != '') {
            if (AccessControl.readGranted(this.HttpContext.authorizations, AccessControl.admin()))
                this.HttpContext.response.JSON(this.repository.get(id));
            else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        }
        else {
            if (AccessControl.granted(this.HttpContext.authorizations, AccessControl.admin()))
                this.HttpContext.response.JSON(this.repository.getAll(this.HttpContext.path.params), this.repository.ETag, false, AccessControl.admin());
            else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        }
    }
    // POST: /token body payload[{"Email": "...", "Password": "..."}]
    login(loginInfo) {
        if (loginInfo) {
            if (this.repository != null) {
                let user = this.repository.findByField("Email", loginInfo.Email);
                if (user != null) {
                    if (user.Password == loginInfo.Password) {
                        user = this.repository.get(user.Id);
                        if (!user.isBlocked){
                            let newToken = TokenManager.create(user);
                            this.HttpContext.response.created(newToken);
                        } else
                            this.HttpContext.response.blockedUser("This user is blocked.");
                    } else
                        this.HttpContext.response.wrongPassword("Wrong password.");
                } else
                    this.HttpContext.response.userNotFound("This user email is not found.");
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.badRequest("Credential Email and password are missing.");
    }
    logout() {
        let userId = this.HttpContext.path.params.userId;
        if (userId) {
            TokenManager.logout(userId);
            this.HttpContext.response.ok();
        } else {
            this.HttpContext.response.badRequest("UserId is not specified.")
        }
    }
    sendVerificationEmail(user) {
        // bypass model bindeExtraData wich hide the user verifyCode
        let html = `
                Bonjour ${user.Name}, <br /> <br />
                Voici votre code pour confirmer votre adresse de courriel
                <br />
                <h3>${user.VerifyCode}</h3>
            `;
        const gmail = new Gmail();
        gmail.send(user.Email, 'Vérification de courriel...', html);
    }

    sendConfirmedEmail(user) {
        let html = `
                Bonjour ${user.Name}, <br /> <br />
                Votre courriel a été confirmé.
            `;
        const gmail = new Gmail();
        gmail.send(user.Email, 'Courriel confirmé...', html);
    }

    //GET : /accounts/verify?id=...&code=.....
    verify() {
        if (this.repository != null) {
            let id = this.HttpContext.path.params.id;
            let code = parseInt(this.HttpContext.path.params.code);
            let userFound = this.repository.findByField('Id', id);
            if (userFound) {
                if (userFound.VerifyCode == code) {
                    userFound.VerifyCode = "verified";
                    this.repository.update(userFound.Id, userFound, false);
                    if (this.repository.model.state.isValid) {
                        userFound = this.repository.get(userFound.Id); // get data binded record
                        this.HttpContext.response.JSON(userFound);
                        this.sendConfirmedEmail(userFound);
                    } else {
                        this.HttpContext.response.unprocessable();
                    }
                } else {
                    this.HttpContext.response.unverifiedUser("Verification code does not match.");
                }
            } else {
                this.HttpContext.response.unprocessable();
            }
        } else
            this.HttpContext.response.notImplemented();
    }
    //GET : /accounts/conflict?Id=...&Email=.....
    conflict() {
        if (this.repository != null) {
            let id = this.HttpContext.path.params.Id;
            let email = this.HttpContext.path.params.Email;
            if (id && email) {
                let prototype = { Id: id, Email: email };
                this.HttpContext.response.JSON(this.repository.checkConflict(prototype));
            } else
                this.HttpContext.response.JSON(false);
        } else
            this.HttpContext.response.JSON(false);
    }

    // POST: account/register body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    register(user) {
        if (this.repository != null) {
            user.Created = utilities.nowInSeconds();
            let verifyCode = utilities.makeVerifyCode(6);
            user.VerifyCode = verifyCode;
            user.Authorizations = AccessControl.user();
            let newUser = this.repository.add(user);
            if (this.repository.model.state.isValid) {
                this.HttpContext.response.created(newUser);
                newUser.Verifycode = verifyCode;
                this.sendVerificationEmail(newUser);
            } else {
                if (this.repository.model.state.inConflict)
                    this.HttpContext.response.conflict(this.repository.model.state.errors);
                else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            }
        } else
            this.HttpContext.response.notImplemented();
    }
    // POST: account/promote body payload[{"Id": ...}]
    promote(user) {
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin())) {
            if (this.repository != null) {
                let foundUser = this.repository.findByField("Id", user.Id);
                foundUser.Authorizations.readAccess++;
                if (foundUser.Authorizations.readAccess > 3 || foundUser.Authorizations.readAccess < 1) foundUser.Authorizations.readAccess = 1;
                foundUser.Authorizations.writeAccess++;
                if (foundUser.Authorizations.writeAccess > 3 || foundUser.Authorizations.writeAccess < 1) foundUser.Authorizations.writeAccess = 1;
                this.repository.update(user.Id, foundUser, false);
                if (this.repository.model.state.isValid) {
                    let userFound = this.repository.get(foundUser.Id); // get data binded record
                    this.HttpContext.response.JSON(userFound);
                } else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized();
    }
    // POST: account/block body payload[{"Id": ...}]
    block(user) {
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin())) {
            if (this.repository != null) {
                let foundUser = this.repository.findByField("Id", user.Id);
                foundUser.Authorizations.readAccess = foundUser.Authorizations.readAccess == -1 ? 1 : -1;
                foundUser.Authorizations.writeAccess = foundUser.Authorizations.writeAccess == -1 ? 1 : -1;
                this.repository.update(user.Id, foundUser, false);
                if (this.repository.model.state.isValid) {
                    foundUser = this.repository.get(foundUser.Id); // get data binded record
                    this.HttpContext.response.JSON(foundUser);
                } else
                    this.HttpContext.response.badRequest(this.repository.model.state.errors);
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized();
    }
    // PUT:account/modify body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    modify(user) {
        // empty asset members imply no change and there values will be taken from the stored record
        if (AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.user()) && this.HttpContext.user.Id == user.Id) {
            if (this.repository != null) {
                user.Created = utilities.nowInSeconds();
                let foundUser = this.repository.findByField("Id", user.Id);
                if (foundUser != null) {
                    user.Authorizations = foundUser.Authorizations; // user cannot change its own authorizations
                    if (user.Password == '') { // password not changed
                        user.Password = foundUser.Password;
                    }
                    if (user.Email != foundUser.Email) {
                        user.VerifyCode = utilities.makeVerifyCode(6);
                        this.sendVerificationEmail(user);
                    } else {
                        user.VerifyCode = foundUser.VerifyCode;
                    }
                    this.repository.update(user.Id, user);
                    let updatedUser = this.repository.get(user.Id); // must get record user.id with binded data

                    if (this.repository.model.state.isValid) {
                        this.HttpContext.response.JSON(updatedUser, this.repository.ETag);
                    }
                    else {
                        if (this.repository.model.state.inConflict)
                            this.HttpContext.response.conflict(this.repository.model.state.errors);
                        else
                            this.HttpContext.response.badRequest(this.repository.model.state.errors);
                    }
                } else
                    this.HttpContext.response.notFound();
            } else
                this.HttpContext.response.notImplemented();
        } else
            this.HttpContext.response.unAuthorized();
    }

    // GET:account/remove/id
    remove(id) { // warning! this is not an API endpoint 
        if (AccessControl.writeGrantedAdminOrOwner(this.HttpContext, this.requiredAuthorizations, id)) {
            if (this.HttpContext.path.id !== '') {
                if (this.repository.remove(id)){
                    //Delete all the user's likes
                    let likesRepository = new Repository(new Like());
                    let likes = likesRepository.getAll({ 'PostId' : id });
                    for (const like of likes) {
                        likesRepository.remove(like.Id);
                    }
                    //Delete all the user's posts
                    let postsRepository = new Repository(new Post());
                    let posts = postsRepository.getAll({ 'OwnerId' : id });
                    for (const post of posts) {
                        postsRepository.remove(post.Id);
                    }
                    this.HttpContext.response.ok();
                }
                else
                    this.HttpContext.response.notFound("Ressource not found.");
            } else
                this.HttpContext.response.badRequest("The Id in the request url is  not specified.");
        } else
            this.HttpContext.response.unAuthorized("Unauthorized access");
    }
}
