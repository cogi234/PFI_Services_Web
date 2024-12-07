import AccessControl from '../accessControl.js';
import Like from '../models/like.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class LikesController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new Like()), AccessControl.user());
    }

    // POST: /likes/toggle body payload[{"PostId": "...", "UserId": "..."}]
    toggle(toggleInfo) {
        if (toggleInfo && toggleInfo.PostId && toggleInfo.UserId) {
            if (AccessControl.granted(this.HttpContext.authorizations, this.requiredAuthorizations) && this.HttpContext.user.Id == toggleInfo.UserId) {
                let foundLike = this.repository.findByFilter((like) => like.UserId == toggleInfo.UserId && like.PostId == toggleInfo.PostId);
                if (foundLike.length > 0) {
                    if (this.repository.remove(foundLike[0].Id))
                        this.HttpContext.response.ok();
                    else
                        this.HttpContext.response.notFound("Ressource not found.");
                } else {
                    this.repository.add(toggleInfo);
                    if (this.repository.model.state.isValid)
                        this.HttpContext.response.ok();
                    else
                        this.HttpContext.response.badRequest(this.repository.model.state.errors);
                }
            } else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        } else
            this.HttpContext.response.badRequest("Missing UserId and/or PostId.");
    }
}
