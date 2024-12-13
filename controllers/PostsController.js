import AccessControl from '../accessControl.js';
import PostModel from '../models/post.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class PostModelsController extends Controller {
    constructor(HttpContext) {
        // anyone can read posts. Only super-users can write them
        super(HttpContext, new Repository(new PostModel()), { readAccess: 0, writeAccess: 2 });
    }
    
    post(data) {
        if (this.HttpContext.user)
            data.OwnerId = this.HttpContext.user.Id;
        super.post(data);
    }
    
    put(data) {
        let foundPost = this.repository.findByField("Id", data.Id);
        if (foundPost ){
            if (this.HttpContext.user && this.HttpContext.user.Id == foundPost.OwnerId){
                data.OwnerId = this.HttpContext.user.Id;
                super.put(data);
            } else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        } else
            this.HttpContext.response.notFound("Ressource not found.");
    }

    
    remove(id) {
        let foundPost = this.repository.findByField("Id", id);
        if (foundPost){
            if (this.HttpContext.user && (this.HttpContext.user.Id == foundPost.OwnerId || this.HttpContext.user.isAdmin))
                super.remove(id);
            else
                this.HttpContext.response.unAuthorized("Unauthorized access");
        } else
            this.HttpContext.response.notFound("Ressource not found.");
    }
}