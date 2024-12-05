class Accounts_API {
    static Host_URL() { return "http://localhost:5001"; }
    static API_URL() { return this.Host_URL() + "/accounts" }
    static TOKEN_URL() { return this.Host_URL() + "/token" }
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }
    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    
    static saveUserData(userObject) {
        sessionStorage.setItem("user", JSON.stringify(userObject));
    }
    static retrieveUserData() {
        return JSON.parse(sessionStorage.getItem("user"));
    }
    static saveAuthToken(token) {
        sessionStorage.setItem("auth_token", token);
    }
    static retrieveAuthToken() {
        return sessionStorage.getItem("auth_token");
    }
    static deleteSessionData() {
        sessionStorage.clear();
    }

    static loggedIn() {
        return this.retrieveAuthToken() !== null;
    }
    static verified() {
        return this.loggedIn() && this.retrieveUserData().VerifyCode == "verified";
    }
    static getReadAccess() {
        if (!this.loggedIn())
            return 0;
        return this.retrieveUserData().Authorizations.readAccess;
    }
    static getWriteAccess() {
        if (!this.loggedIn())
            return 0;
        return this.retrieveUserData().Authorizations.writeAccess;
    }
    
    //#region  AJAX FUNCTIONS

    // POST: /token body payload[{"Email": "...", "Password": "..."}]
    static async Login(data) {
        Accounts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.TOKEN_URL(),
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Accounts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    // GET: /accounts/logout?userId={userId}
    static async Logout() {
        Accounts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/logout?userId=" + this.retrieveUserData().Id,
                success: (data) => { resolve(data); },
                error: (xhr) => { Accounts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    // POST: account/register body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    static async Register(data) {
        Accounts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/register",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Accounts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    //GET : /accounts/verify?id=...&code=.....
    static async Verify(code) {
        Accounts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/verify?id=" + this.retrieveUserData().Id + "&code=" + code,
                success: (data) => { resolve(data); },
                error: (xhr) => { Accounts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }

    //#endregion
}