import Like from './like.js';
import Model from './model.js';
import Repository from './repository.js';
import User from './user.js';

export default class Post extends Model {
    constructor() {
        super(true /* secured Id */);

        this.addField('Title', 'string');
        this.addField('Text', 'string');
        this.addField('Category', 'string');
        this.addField('Image', 'asset');
        this.addField('Date', 'integer');
        this.addField('OwnerId', 'string');

        this.setKey("Title");
    }
    
    bindExtraData(instance) {
        instance = super.bindExtraData(instance);

        let usersRepository = new Repository(new User());
        let likesRepository = new Repository(new Like());

        //Owner binding
        let owner = usersRepository.get(instance.OwnerId);
        if (owner != null) {
            instance.OwnerName = owner.Name;
            instance.OwnerAvatar = owner.Avatar;
        } else {
            instance.OwnerName = null;
            instance.OwnerAvatar = null;
        }

        //Likes binding
        let likes = likesRepository.getAll({ 'PostId' : instance.Id });
        let likers = [];
        for (const like of likes) {
            let liker = usersRepository.get(like.UserId);
            likers.push(liker.Name);
        }
        instance.Likes = likers;

        return instance;
    }
}