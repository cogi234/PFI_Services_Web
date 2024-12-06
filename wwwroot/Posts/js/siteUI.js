////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;

Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function initialView() {
    $("#createPost").show();
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    initialView();
    //If we're logged in but not verified, we need to verify
    if (Accounts_API.loggedIn() && !Accounts_API.verified()) {
        showVerificationForm();
        return;
    }
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}
function showConnectionForm(message = null) {
    showForm();
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $("#viewTitle").text("Connexion");
    renderConnectionForm(message);
}
function showRegisterForm() {
    showForm();
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $("#viewTitle").text("Inscription");
    renderRegisterForm();
}
function showProfileForm() {
    showForm();
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $("#viewTitle").text("Modification");
    renderProfileForm();
}
function showVerificationForm() {
    showForm();
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $("#viewTitle").text("Vérification");
    renderVerificationForm();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    $("#reloadPosts").addClass('white');
    $("#reloadPosts").on('click', async function () {
        $("#reloadPosts").addClass('white');
        postsPanel.resetScrollPosition();
        await showPosts();
    })
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            let postsCount = parseInt(etag.split("-")[0]);
            if (currentETag != etag) {
                if (postsCount != currentPostsCount) {
                    console.log("postsCount", postsCount)
                    currentPostsCount = postsCount;
                    $("#reloadPosts").removeClass('white');
                } else
                    await showPosts();
                
                currentETag = etag;
            }
        }
    }, periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    addWaitingGif();
    let response = await Posts_API.GetQuery(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        currentPostsCount = parseInt(currentETag.split("-")[0]);
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                postsPanel.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post, loggedUser) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let crudIcon =
        `
        <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
        <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
        `;

    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${crudIcon}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu();
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    //User management
    if (Accounts_API.loggedIn()) {
        let user = Accounts_API.retrieveUserData();
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout">
                <b><img class="UserAvatarXSmall" src="${user.Avatar}"></img>${user.Name}</b>
            </div>
            `));
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="profileCmd">
                <i class="menuIcon fa fa-user-pen mx-2"></i> Modifier votre profil
            </div>
            <div class="dropdown-item menuItemLayout" id="disconnectCmd">
                <i class="menuIcon fa fa-arrow-right-from-bracket mx-2"></i> Déconnexion
            </div>
            `));
    } else {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="connectCmd">
                <i class="menuIcon fa fa-arrow-right-to-bracket mx-2"></i> Connexion
            </div>
            `));
    }
    //Categories
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    //About
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));

    //Commands
    $('#connectCmd').on("click", function () {
        showConnectionForm();
    });
    $('#profileCmd').on("click", function () {
        showProfileForm();
    });
    $('#disconnectCmd').on("click", async function () {
        Accounts_API.Logout();
        if (!Accounts_API.error) {
            Accounts_API.deleteSessionData();
            updateDropDownMenu();
            await showPosts(true);
        }
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
}
function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");
    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    return Post;
}
function renderPostForm(post = null) {
    let create = post == null;
    if (create) post = newPost();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function renderConnectionForm(message){
    $("#form").empty();
    if (message !== null) {
        $("#form").append(`
            <h2 style="text-align: center; margin-top: 1rem;">${message}</h2>
        `);
    }
    $("#form").append(`
        <form class="form centered" style="width: 50%; min-width: 300px; padding-top: 2rem;"
            id="connectForm">
            <input class="form-control Email full-width"
                name="Email"
                id="Email"
                placeholder="Courriel"
                required
                style="margin: 1rem 0px;"
            />
            <div class="text-danger" id="email-error"></div>
            <input class="form-control full-width"
                type="password"
                name="Password" 
                id="Password"
                placeholder="Mot de passe"
                required
                RequireMessage="Mot de passe incorrect"
                InvalidMessage="Mot de passe incorrect"
                style="margin: 1rem 0px;"
            />
            <div class="text-danger" id="password-error"></div>
            <input 
                type="submit" 
                value="Se connecter" 
                id="login" 
                class="btn btn-primary full-width"
                style="margin: 1rem 0px;"
            />
            <hr>
            <input 
                type="button" 
                value="Nouveau Compte" 
                id="registerCmd" 
                class="btn btn-info full-width"
                style="margin: 1rem 0px;"
            />
        </form>
    `);

    initFormValidation(); // important do to after all html injection!

    $('#connectForm').off();
    $('#connectForm').on("submit", async function (event) {
        event.preventDefault();
        
        $('#email-error').empty();
        $('#password-error').empty();

        let connectData = getFormData($("#connectForm"));
        result = await Accounts_API.Login(connectData);
        if (!Accounts_API.error) {
            Accounts_API.saveUserData(result.User);
            Accounts_API.saveAuthToken(result.Access_token);
            updateDropDownMenu();
            await showPosts();
        }  else if (Accounts_API.currentStatus == 481) {
            $('#email-error').text('Courriel introuvable');
        }  else if (Accounts_API.currentStatus == 482) {
            $('#password-error').text('Mot de passe incorrect');
        } else
            showError("Une erreur est survenue! ", Accounts_API.currentHttpError);
    });
    $('#registerCmd').off();
    $('#registerCmd').on("click", function () {
        showRegisterForm();
    });
}
function renderRegisterForm(){
    $("#form").empty();
    $("#form").append(`
        <form class="form centered" style="width: 50%; min-width: 300px; padding-top: 2rem;"
            id="registerForm">
            <div class="input-group">
                <label for="Email" class="form-label full-width">Adresse courriel</label>
                <input class="form-control Email full-width"
                    name="Email"
                    id="Email"
                    placeholder="Courriel"
                    CustomErrorMessage="Ce courriel est déjà utilisé"
                    required
                    style="margin: 1rem 0px;"
                /><br>
                <input class="form-control MatchedInput full-width"
                    matchedInputId="Email"
                    name="EmailVerification"
                    id="EmailVerification"
                    placeholder="Vérification"
                    required
                    style="margin: 1rem 0px;"
                />
            </div>
            <div class="input-group">
                <label for="Password" class="form-label full-width">Mot de passe</label>
                <input class="form-control full-width"
                    type="password"
                    name="Password" 
                    id="Password"
                    placeholder="Mot de passe"
                    required
                    InvalidMessage="Mot de passe incorrect"
                    style="margin: 1rem 0px;"
                /><br>
                <input class="form-control MatchedInput full-width"
                    type="password"
                    matchedInputId="Password"
                    name="PasswordVerification"
                    id="PasswordVerification"
                    placeholder="Vérification"
                    required
                    style="margin: 1rem 0px;"
                />
            </div>
            <div class="input-group">
                <label for="Name" class="form-label full-width">Nom</label>
                <input class="form-control full-width Alpha"
                    name="Name" 
                    id="Name"
                    placeholder="Nom"
                    required
                    style="margin: 1rem 0px;"
                />
            </div>
            <div class="input-group">
                <label class="form-label">Avatar </label>
                <div class='imageUploaderContainer'>
                    <div class='imageUploader' 
                        controlId='Avatar'
                        newImage='true'
                        imageSrc='no-avatar.png' 
                        waitingImage="Loading_icon.gif">
                    </div>
                </div>
            </div>
            <input 
                type="submit" 
                value="S'inscrire" 
                id="register" 
                class="btn btn-primary full-width"
                style="margin: 1rem 0px;"
            />
            <input 
                type="button" 
                value="Annuler" 
                id="cancelCmd" 
                class="btn btn-secondary full-width"
                style="margin: 1rem 0px;"
            />
        </form>
    `);

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!
    addConflictValidation(Accounts_API.API_URL() + "/conflict", "Email", "register");// Validate email conflicts

    $('#registerForm').off();
    $('#registerForm').on("submit", async function (event) {
        event.preventDefault();
        let registerData = getFormData($("#registerForm"));
        result = await Accounts_API.Register(registerData);
        if (!Accounts_API.error) {
            showConnectionForm("Votre compte a été créé. Veuillez vérifier vos courriels pour récupérer votre code de vérification.");
        } else
            showError("Une erreur est survenue! ", Accounts_API.currentHttpError);
    });
    $('#cancelCmd').off();
    $('#cancelCmd').on("click", async function () {
        showConnectionForm();
    });
}
function renderProfileForm(){
    let originalUser = Accounts_API.retrieveUserData();
    $("#form").empty();
    $("#form").append(`
        <form class="form centered" style="width: 50%; min-width: 300px; padding-top: 2rem;"
            id="profileForm">
            <input type="hidden" name="Id" id="Id" value="${originalUser.Id}">
            <div class="input-group">
                <label for="Email" class="form-label full-width">Adresse courriel</label>
                <input class="form-control Email full-width"
                    name="Email"
                    id="Email"
                    placeholder="Courriel"
                    CustomErrorMessage="Ce courriel est déjà utilisé"
                    required
                    style="margin: 1rem 0px;"
                    value="${originalUser.Email}"
                /><br>
                <input class="form-control MatchedInput full-width"
                    matchedInputId="Email"
                    name="EmailVerification"
                    id="EmailVerification"
                    placeholder="Vérification"
                    required
                    style="margin: 1rem 0px;"
                    value="${originalUser.Email}"
                />
            </div>
            <div class="input-group">
                <label for="Password" class="form-label full-width">Mot de passe</label>
                <input class="form-control full-width"
                    type="password"
                    name="Password" 
                    id="Password"
                    placeholder="Mot de passe"
                    InvalidMessage="Mot de passe incorrect"
                    style="margin: 1rem 0px;"
                /><br>
                <input class="form-control MatchedInput full-width"
                    type="password"
                    matchedInputId="Password"
                    name="PasswordVerification"
                    id="PasswordVerification"
                    placeholder="Vérification"
                    style="margin: 1rem 0px;"
                />
            </div>
            <div class="input-group">
                <label for="Name" class="form-label full-width">Nom</label>
                <input class="form-control full-width Alpha"
                    name="Name" 
                    id="Name"
                    placeholder="Nom"
                    required
                    style="margin: 1rem 0px;"
                    value="${originalUser.Name}"
                />
            </div>
            <div class="input-group">
                <label class="form-label">Avatar </label>
                <div class='imageUploaderContainer'>
                    <div class='imageUploader' 
                        controlId='Avatar'
                        newImage='false'
                        imageSrc='${originalUser.Avatar}' 
                        waitingImage="Loading_icon.gif">
                    </div>
                </div>
            </div>
            <input 
                type="submit" 
                value="Enregistrer" 
                id="save" 
                class="btn btn-primary full-width"
                style="margin: 1rem 0px;"
            />
            <input 
                type="button" 
                value="Effacer le compte" 
                id="deleteCmd" 
                class="btn btn-info full-width"
                style="margin: 1rem 0px;"
            />
        </form>
    `);

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!
    addConflictValidation(Accounts_API.API_URL() + "/conflict", "Email", "register");// Validate email conflicts

    $('#profileForm').off();
    $('#profileForm').on("submit", async function (event) {
        event.preventDefault();
        let userData = getFormData($("#profileForm"));
        result = await Accounts_API.Modify(userData);
        if (!Accounts_API.error) {
            Accounts_API.saveUserData(result);
            updateDropDownMenu();
            await showPosts();
        } else
            showError("Une erreur est survenue! ", Accounts_API.currentHttpError);
    });
    $('#deleteCmd').off();
    $('#deleteCmd').on("click", async function () {
        showAccountDeleteForm();
    });
}
function renderVerificationForm(){
    $("#form").empty();
    $("#form").append(`
        <form class="form centered" style="width: 50%; min-width: 300px; padding-top: 2rem;"
            id="verifyForm">
            <label for="Code" class="form-label full-width">Nom</label>
            <input class="form-control full-width"
                name="Code"
                id="Code"
                placeholder="Code de vérification"
                required
                style="margin: 1rem 0px;"
            />
            <input 
                type="submit" 
                value="Vérifier" 
                id="verify" 
                class="btn btn-primary full-width"
                style="margin: 1rem 0px;"
            />
        </form>
    `);

    initFormValidation(); // important do to after all html injection!

    $('#verifyForm').off();
    $('#verifyForm').on("submit", async function (event) {
        event.preventDefault();

        $('#code-error').empty();
        
        let verificationCode = getFormData($("#verifyForm")).Code;
        result = await Accounts_API.Verify(verificationCode);
        if (!Accounts_API.error) {
            let user = Accounts_API.retrieveUserData();
            user.VerifyCode = "verified";
            Accounts_API.saveUserData(user);
            await showPosts();
        } else if (Accounts_API.currentStatus == 480) {
            $('#code-error').text('Code de vérification invalide');
        } else
            showError("Une erreur est survenue! ", Accounts_API.currentHttpError);
    });
}

function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}