import PostModel from '../models/post.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class PostModelsController extends Controller {
    constructor(HttpContext) {
        // anyone can read posts. Only super-users can write them
        super(HttpContext, new Repository(new PostModel()), { readAccess: 0, writeAccess: 2 });
    }
}